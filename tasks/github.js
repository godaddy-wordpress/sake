import { Octokit as GitHub } from '@octokit/rest'
import inquirer from 'inquirer'
import fs from 'node:fs'
import path from 'node:path'
import async from 'async'
import chalk from 'chalk'
import codename from 'codename'
import dateFormat from 'dateformat'
import log from 'fancy-log'
import sake from '../lib/sake.js'
import gulp from 'gulp'
import minimist from 'minimist';
import { gitReleaseTag, gitReleaseUploadUrl, isNonInteractive } from '../helpers/arguments.js'

let githubInstances = {}

let getGithub = (target = 'dev') => {
  if (! githubInstances[target]) {
    githubInstances[target] = new GitHub({
      debug: false,
      auth: process.env[`SAKE_${target.toUpperCase()}_GITHUB_API_KEY`] || process.env.GITHUB_API_KEY
    })
  }

  return githubInstances[target]
}

const gitHubGetReleaseIssueTask = (done) => {
  let owner = sake.config.deploy.dev.owner
  let repo = sake.config.deploy.dev.name
  let github = getGithub('dev')

  let labels = ['release']

  if (sake.config.multiPluginRepo) {
    labels.push(sake.config.plugin.id.replace('woocommerce-', ''))
  }

  github.issues.listForRepo({
    owner: owner,
    repo: repo,
    state: 'open',
    labels: labels.join(',')
  }).then((result) => {
    if (! result.data.length) {
      done()
    } else {
      inquirer.prompt([{
        type: 'list',
        name: 'issues_to_close',
        message: 'Release issues exist for ' + sake.getPluginName() + '. Select an issue this release should close.',
        choices: function () {
          let choices = result.data.filter((result) => !result.pull_request).map((result) => {
            return {
              value: result.number,
              name: 'Close issue #' + result.number + ': ' + result.html_url
            }
          })

          choices.push({
            value: 'none',
            name: 'None'.red
          })

          return choices
        }
      }]).then(function (answers) {
        if (answers.issues_to_close === 'none') {
          log.warn(chalk.yellow('No issues will be closed for release of ' + sake.getPluginName()))
        } else {
          sake.options.release_issue_to_close = answers.issues_to_close
        }
        done()
      })
    }
  }).catch((err) => {
    log.error(chalk.red('Could not get release issue: ' + err.toString()))
    done()
  })
}
gitHubGetReleaseIssueTask.displayName = 'github:get_rissue'

const gitHubGetWcIssuesTask = (done) => {
  if (!sake.config.deploy.production) {
    log.warn(chalk.yellow('No WC (production) repo configured for ' + sake.getPluginName() + ', skipping'))
    return done()
  }

  let owner = sake.config.deploy.production.owner
  let repo = sake.config.deploy.production.name
  let github = getGithub('production')

  github.issues.listForRepo({
    owner: owner,
    repo: repo,
    state: 'open'
  })
    .then((result) => {
      if (! result.data.length) {
        done()
      } else {
        inquirer.prompt([{
          type: 'checkbox',
          name: 'issues_to_close',
          message: 'Issues on WC repo exist for ' + sake.getPluginName() + '. Select an issue this release should close. To skip, press Enter without selecting anything.',
          choices: function () {
            return result.data.filter((result) => !result.pull_request).sort().map((result) => {
              return {
                value: result.number,
                name: 'Close issue #' + result.number + ': ' + result.html_url
              }
            })
          }
        }]).then(function (answers) {
          if (answers.issues_to_close === 'none') {
            log.warn('No issues will be closed for release of ' + sake.getPluginName())
          } else {
            sake.options.wc_issues_to_close = answers.issues_to_close
          }
          done()
        })
      }
    })
    .catch((err) => {
      log.error(chalk.red('Could not get issues for WC repo: ' + err.toString()))
      done()
    })
}
gitHubGetWcIssuesTask.displayName = 'github:get_wc_issues'

/**
 * Creates a docs issue for the plugin
 */
const gitHubCreateDocsIssueTask = (done) => {
  if (isNonInteractive()) {
    return done()
  }

  if (! sake.config.deploy.docs) {
    log.warn(chalk.yellow('No docs repo configured for ' + sake.getPluginName() + ', skipping'))
    return done()
  }

  let owner = sake.config.deploy.docs.owner
  let repo = sake.config.deploy.docs.name
  let github = getGithub('docs')

  let message = 'Should a Docs issue be created for ' + sake.getPluginName() + '?'

  if (sake.pluginHasNewFeatures()) {
    message += chalk.yellow('\n\nThe changelog below contains new features and/or tweaks.\nA docs issue should always be created for releases with new features or user-facing changes.')
  }

  inquirer.prompt([{
    type: 'list',
    name: 'create_docs_issue',
    message: message + '\n\nChangelog: \n\n' + sake.getPluginChanges() + '\n\n',
    choices: [{
      value: 1,
      name: 'Yes -- create a docs issue'
    }, {
      value: 0,
      name: "No -- don't create a docs issue!"
    }],
    default: sake.pluginHasNewFeatures() ? 0 : 1
  }]).then(function (answers) {
    if (answers.create_docs_issue) {
      github.issues.create({
        owner: owner,
        repo: repo,
        title: sake.getPluginName() + ': Updated to ' + sake.getPluginVersion(),
        body: sake.getPluginChanges() + (sake.options.release_issue_to_close ? '\r\n\r\nSee ' + sake.config.deploy.dev.owner + '/' + sake.config.deploy.dev.name + '#' + sake.options.release_issue_to_close : ''),
        labels: [sake.config.plugin.id.replace('woocommerce-', ''), 'docs', 'sales']
      }).then((result) => {
        log(result)
        log('Docs issue created!')

        done()
      }).catch(sake.throwError)
    } else {
      log.warn('No docs issue was created for ' + sake.getPluginName())
      done()
    }
  })
}
gitHubCreateDocsIssueTask.displayName = 'github:docs_issue'

/**
 * Creates a release for the plugin, attaching the build zip to it
 */
const gitHubCreateReleaseTask = (done) => {
  let owner = sake.options.owner
  let repo = sake.options.repo || sake.config.plugin.id

  if (! owner || ! repo) {
    log.warn(chalk.yellow('The owner or the slug of the repo for ' + sake.getPluginName() + ' are missing, skipping'))
    return done()
  }

  let github = getGithub(sake.options.owner === sake.config.deploy.production.owner ? 'production' : 'dev')

  let version = sake.getPluginVersion()
  const {zipName, zipPath} = getZipNameAndPath()

  let tasks = []

  // prepare a zip if it doesn't already exist
  if (! fs.existsSync(zipPath)) {
    tasks.push(sake.options.deploy ? 'compress' : 'zip')
  }

  log(`Creating GH release ${version} for ${owner}/${repo}`)

  tasks.push(function (cb) {
    github.repos.createRelease({
      owner: owner,
      repo: repo,
      tag_name: sake.options.prefix_release_tag ? sake.config.plugin.id + '-' + version : version,
      name: sake.getPluginName(false) + ' v' + version,
      body: sake.getPluginChanges()
    }).then((result) => {
      log('GH release created')

      sake.options.release_url = result.data.html_url

      uploadZipToRelease(zipPath, zipName, result.data.upload_url).then(() => {
          log('Plugin zip uploaded')
          cb()
      }).catch((err) => {
        sake.throwError('Uploading release ZIP failed: ' + err.toString())
      })
    }).catch((err) => {
      sake.throwError('Creating GH release failed: ' + err.toString())
    })
  })

  gulp.series(tasks)(done)
}
gitHubCreateReleaseTask.displayName = 'github:create_release'

const gitHubUploadZipToReleaseTask = (done) => {
  if (! gitReleaseTag()) {
    sake.throwError('No --release-tag provided.')
  }

  // why do we have to do this? lol
  sake.options.owner = sake.config.deploy.dev.owner
  sake.options.repo = sake.config.deploy.dev.name

  getGitHubReleaseFromTagName(gitReleaseTag())
    .then(response => {
      const releaseUploadUrl = response.data.upload_url

      const {zipName, zipPath} = getZipNameAndPath()

      log(`Uploading zip ${zipName} to release ${releaseUploadUrl}`)

      let tasks = []

      // prepare a zip if it doesn't already exist
      if (! fs.existsSync(zipPath)) {
        tasks.push(sake.options.deploy ? 'compress' : 'zip')
      }

      tasks.push(function (cb) {
        uploadZipToRelease(zipPath, zipName, releaseUploadUrl).then(() => {
          log('Plugin zip uploaded')
          cb()
        }).catch((err) => {
          sake.throwError('Uploading release ZIP failed: ' + err.toString())
        })
      })

      gulp.series(tasks)(done)
    })
    .catch((err) => {
      sake.throwError('Failed to upload zip to release: '.err.toString())
    })
}
gitHubUploadZipToReleaseTask.displayName = 'github:upload_zip_to_release'

/**
 *
 * @param {string} tagName
 * @returns {Promise}
 */
function getGitHubReleaseFromTagName(tagName)
{
  let github = getGithub(sake.options.owner === sake.config.deploy.production.owner ? 'production' : 'dev')
  const owner = sake.options.owner
  const repo = sake.options.repo || sake.config.plugin.id

  if (! owner || ! repo) {
    sake.throwError(chalk.yellow('The owner or the slug of the repo for ' + sake.getPluginName() + ' are missing.'))
  }

  return github.request('GET /repos/{owner}/{repo}/releases/tags/{tag}', {
    owner: owner,
    repo: repo,
    tag: tagName
  })
}

function getZipNameAndPath()
{
  let version = sake.getPluginVersion()
  let zipName = `${sake.config.plugin.id}.${version}.zip`
  let zipPath = path.join(process.cwd(), sake.config.paths.build, zipName)

  return {
    zipName: zipName,
    zipPath: zipPath
  }
}

function uploadZipToRelease(zipPath, zipName, releaseUrl)
{
  let github = getGithub(sake.options.owner === sake.config.deploy.production.owner ? 'production' : 'dev')

  return github.repos.uploadReleaseAsset({
    url: releaseUrl,
    name: zipName,
    data: fs.readFileSync(zipPath),
    headers: {
      'content-type': 'application/zip',
      'content-length': fs.statSync(zipPath).size
    }
  })
}

/**
 * Create release milestones for each Tuesday
 */
const gitHubCreateReleaseMilestonesTask = (done) => {
  let year = sake.options.year || new Date().getFullYear()
  let tuesdays = getTuesdays(year)

  createMilestones(tuesdays, done)

  // helper function to get all tuesdays of a year
  function getTuesdays (y) {
    // ensure year is an integer
    y = parseInt(y, 10)

    let d = new Date(y, 0, 1)
    let tuesdays = []

    // get the first Tuesday in January
    d.setDate(d.getDate() + (9 - d.getDay()) % 7)

    while (y === d.getFullYear()) {
      let date = new Date(d.getTime())
      tuesdays.push({ date: date, name: `Deploy on ${dateFormat(date, 'mm/dd')}` })
      d.setDate(d.getDate() + 7)
    }

    return tuesdays
  }
}
gitHubCreateReleaseMilestonesTask.displayName = 'github:create_release_milestones'

/**
 * Create monthly milestones
 */
const gitHubCreateMonthMilestonesTask = (done) => {
  let year = sake.options.year || new Date().getFullYear()

  createMilestones(getMonthlyMilestones(year), done)

  // helper to get all months in a year
  function getMonthlyMilestones (y) {
    // ensure year is an integer
    y = parseInt(y, 10)

    let months = []

    for (let i = 0; i < 12; i++) {
      let d = new Date(y, i + 1, 0)
      months.push({ date: d, name: dateFormat(d, 'mmmm yyyy') })
    }

    return months
  }
}
gitHubCreateMonthMilestonesTask.displayName = 'github:create_month_milestones'

// create a milestone for each date passed in
const createMilestones = (milestones, done) => {
  let owner = sake.options.owner || sake.config.deploy.dev.owner
  let repo = sake.options.repo || sake.config.deploy.dev.name
  let github = getGithub(sake.options.owner === sake.config.deploy.production.owner ? 'production' : 'dev')

  async.eachLimit(milestones, 5, function (milestone, cb) {
    let description = codename().generate(['unique', 'alliterative', 'random'], ['adjectives', 'animals']).join(' ')
    let formattedDate = dateFormat(milestone.date, 'yyyy-mm-dd')

    github.issues.createMilestone({
      owner: owner,
      repo: repo,
      title: milestone.name,
      description: description,
      due_on: milestone.date
    }).then((result) => {
      log.info(chalk.green(`Milestone ${description} for ${formattedDate} created!`))
      cb()
    }).catch((err) => {
      // format the error for readability
      let formattedError = err
      try {
        if (err.message) {
          err = JSON.parse(err.message)
        }
        formattedError = JSON.stringify(err, null, 2)
      } catch (e) { }
      log.error(chalk.red(`Error creating milestone ${description} for ${formattedDate}:`) + '\n' + formattedError)
    })
  }, function (error) {
    done(error)
  })
}

export {
  gitHubGetReleaseIssueTask,
  gitHubGetWcIssuesTask,
  gitHubCreateDocsIssueTask,
  gitHubCreateReleaseTask,
  gitHubUploadZipToReleaseTask,
  gitHubCreateReleaseMilestonesTask,
  gitHubCreateMonthMilestonesTask
}
