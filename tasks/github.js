const GitHub = require('@octokit/rest')
const inquirer = require('inquirer')
const fs = require('fs')
const path = require('path')
const async = require('async')
const codename = require('codename')
const dateFormat = require('dateformat')
const log = require('fancy-log')

module.exports = (gulp, plugins, sake) => {
  gulp.task('github:get_rissue', (done) => {
    let owner = sake.config.deploy.dev.owner
    let repo = sake.config.deploy.dev.name

    let github = new GitHub({
      protocol: 'https',
      debug: false
    })

    github.authenticate({
      type: 'basic',
      username: process.env.GITHUB_USERNAME,
      password: process.env.GITHUB_API_KEY
    })

    let labels = ['release']

    if (sake.config.multiPluginRepo) {
      labels.push(sake.config.plugin.id.replace('woocommerce-', ''))
    }

    github.issues.getForRepo({
      owner: owner,
      repo: repo,
      state: 'open',
      labels: labels.join(',')
    }, function (err, result) {
      if (err) {
        log.error('Could not get release issue: ' + err.toString())
        done()
      } else {
        if (!result.data.length) {
          done()
        } else {
          inquirer.prompt([ {
            type: 'list',
            name: 'issues_to_close',
            message: 'Release issues exist for ' + sake.getPluginName() + '. Select an issue this release should close.',
            choices: function () {
              let choices = result.data.map((result) => {
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
          } ]).then(function (answers) {
            if (answers.issues_to_close === 'none') {
              log.warn('No issues will be closed for release of ' + sake.getPluginName())
            } else {
              sake.options.release_issue_to_close = answers.issues_to_close
            }
            done()
          })
        }
      }
    })
  })

  gulp.task('github:get_wc_issues', (done) => {
    let owner = sake.config.deploy.production.owner
    let repo = sake.config.deploy.production.name

    let github = new GitHub({
      protocol: 'https',
      debug: false
    })

    github.authenticate({
      type: 'basic',
      username: process.env.GITHUB_USERNAME,
      password: process.env.GITHUB_API_KEY
    })

    github.issues.getForRepo({
      owner: owner,
      repo: repo,
      state: 'open'
    }, function (err, result) {
      if (err) {
        log.error('Could not get issues for WC repo: ' + err.toString())
        done()
      } else {
        if (!result.data.length) {
          done()
        } else {
          inquirer.prompt([ {
            type: 'checkbox',
            name: 'issues_to_close',
            message: 'Issues on WC repo exist for ' + sake.getPluginName() + '. Select an issue this release should close.',
            choices: function () {
              let choices = result.data.sort().map((result) => {
                return {
                  value: result.number,
                  name: 'Close issue #' + result.number + ': ' + result.html_url
                }
              })

              return choices
            }
          } ]).then(function (answers) {
            if (answers.issues_to_close === 'none') {
              log.warn('No issues will be closed for release of ' + sake.getPluginName())
            } else {
              sake.options.wc_issues_to_close = answers.issues_to_close
            }
            done()
          })
        }
      }
    })
  })

  // creates a docs issue for the plugin
  gulp.task('github:docs_issue', (done) => {
    let owner = 'skyverge'
    let repo = 'wc-plugins-sales-docs'
    let assignee = 'bekarice'

    let github = new GitHub({
      protocol: 'https',
      debug: true
    })

    github.authenticate({
      type: 'basic',
      username: process.env.GITHUB_USERNAME,
      password: process.env.GITHUB_API_KEY
    })

    inquirer.prompt([ {
      type: 'list',
      name: 'create_docs_issue',
      message: 'Should a Docs issue be created for ' + sake.getPluginName() + '? See the changelog: \n\n' + sake.getPluginChanges() + '\n\n',
      choices: [{
        value: 1,
        name: 'Yes -- create a docs issue'
      }, {
        value: 0,
        name: "No -- don't create a docs issue!"
      }]
    } ]).then(function (answers) {
      if (answers.create_docs_issue) {
        github.issues.create({
          owner: owner,
          repo: repo,
          title: sake.getPluginName() + ': Updated to ' + sake.getPluginVersion(),
          body: sake.getPluginChanges() + (sake.options.release_issue_to_close ? '\r\n\r\nSee skyverge/' + sake.config.plugin.id + '#' + sake.options.release_issue_to_close : ''),
          assignee: assignee,
          labels: [ sake.config.plugin.id.replace('woocommerce-', ''), 'docs', 'sales' ]
        }, function (err, result) {
          if (!err) {
            log(result)
            log('Docs issue created!')
          }
          sake.throwError(err)
        })
      } else {
        log.warn('No docs issue was created for ' + sake.getPluginName())
        done()
      }
    })
  })

  // creates a release for the plugin, attaching the build zip to it
  gulp.task('github:create_release', (done) => {
    let owner = sake.options.owner || 'skyverge'
    let repo = sake.options.repo || sake.config.plugin.id
    let version = sake.getPluginVersion()
    let zipName = `${sake.config.plugin.id}.${version}.zip`
    let zipPath = path.join(process.cwd(), sake.config.paths.build, zipName)
    let tasks = []

    // prepare a zip if it doesn't already exist
    if (!fs.existsSync(zipPath)) {
      tasks.push(sake.options.deploy ? 'compress' : 'zip')
    }

    let github = new GitHub({
      protocol: 'https',
      debug: true
    })

    github.authenticate({
      type: 'basic',
      // TODO: consider moving these to sake.config instead
      username: process.env.GITHUB_USERNAME,
      password: process.env.GITHUB_API_KEY
    })

    log(`Creating GH release ${version} for ${owner}/${repo}`)

    tasks.push(function (cb) {
      github.repos.createRelease({
        owner: owner,
        repo: repo,
        tag_name: version,
        name: sake.getPluginName(false) + ' v' + version,
        body: sake.getPluginChanges()
      }, function (err, result) {
        if (err) sake.throwError('Creating GH release failed: ' + err.toString())

        log('GH release created')

        // set the release url for Trello task
        sake.options.release_url = result.data.html_url

        github.repos.uploadAsset({
          url: result.data.upload_url,
          name: zipName,
          file: fs.readFileSync(zipPath),
          contentType: 'application/zip',
          contentLength: fs.statSync(zipPath).size
        }, function (err) {
          if (err) sake.throwError('Uploading release ZIP failed: ' + err.toString())

          log('Plugin zip uploaded')
          cb()
        })
      })
    })

    gulp.series(tasks)(done)
  })

  // create release milestones for each tuesday
  gulp.task('github:create_release_milestones', (done) => {
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
        tuesdays.push(new Date(d.getTime()))
        d.setDate(d.getDate() + 7)
      }

      return tuesdays
    }
  })

  // create monthly milestones
  gulp.task('github:create_month_milestones', (done) => {
    let year = sake.options.year || new Date().getFullYear()
    let months = getMonths(year)

    createMilestones(months, done)

    // helper to get all months in a year
    function getMonths (y) {
      // ensure year is an integer
      y = parseInt(y, 10)

      let months = []

      for (let i = 0; i < 12; i++) {
        let d = new Date(y, i + 1, 0)
        months.push(d)
      }

      return months
    }
  })

  // create a milestone for each date passed in
  const createMilestones = (dates, done) => {
    let owner = sake.options.owner || 'skyverge'
    let repo = sake.options.repo || sake.config.plugin.id

    let github = new GitHub({
      protocol: 'https',
      debug: true
    })

    github.authenticate({
      type: 'basic',
      username: process.env.GITHUB_USERNAME,
      password: process.env.GITHUB_API_KEY
    })

    async.each(dates, function (date, cb) {
      let milestoneName = codename.generate([ 'unique', 'alliterative', 'random' ], [ 'adjectives', 'animals' ])

      github.issues.createMilestone({
        owner: owner,
        repo: repo,
        title: dateFormat(date, 'mmmm yyyy'),
        description: milestoneName ? milestoneName[0] + ' ' + milestoneName[1] : '',
        due_on: date
      }, function (err, result) {
        if (err) {
          log.error('Error creating milestone')
        } else {
          log(result)
          log('Milestone created!')
        }
        cb()
      })
    }, function (error) {
      done(!error)
    })
  }
}
