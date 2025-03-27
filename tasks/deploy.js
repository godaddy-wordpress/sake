import fs from 'node:fs';
import dateFormat from 'dateformat';
import _ from 'lodash';
import axios from 'axios';
import log from 'fancy-log';
import chalk from 'chalk';
import sake from '../lib/sake.js'
import gulp from 'gulp'
import filter from 'gulp-filter'
import replace from 'gulp-replace'
import replaceTask from 'gulp-replace-task'
import { promptDeployTask, promptTestedReleaseZipTask, promptWcUploadTask } from './prompt.js'
import { bumpMinReqsTask, bumpTask } from './bump.js'
import { cleanBuildTask, cleanPrereleaseTask, cleanWcRepoTask, cleanWpAssetsTask, cleanWpTrunkTask } from './clean.js'
import { buildTask } from './build.js'
import {
  gitHubCreateDocsIssueTask,
  gitHubCreateReleaseTask,
  gitHubGetReleaseIssueTask,
  gitHubGetWcIssuesTask, gitHubUploadZipToReleaseTask
} from './github.js'
import {
  shellGitEnsureCleanWorkingCopyTask,
  shellGitPullWcRepoTask,
  shellGitPushUpdateTask,
  shellGitPushWcRepoTask,
  shellGitUpdateWcRepoTask, shellSvnCheckoutTask,
  shellSvnCommitAssetsTask,
  shellSvnCommitTagTask,
  shellSvnCommitTrunkTask
} from './shell.js'
import { zipTask } from './zip.js'
import { validateReadmeHeadersTask } from './validate.js'
import { lintScriptsTask, lintStylesTask } from './lint.js'
import { copyBuildTask, copyWcRepoTask, copyWpAssetsTask, copyWpTagTask, copyWpTrunkTask } from './copy.js'
import {
  gitReleaseTag,
  hasGitRelease,
  isDryRunDeploy,
  isNonInteractive,
  withoutCodeChanges
} from '../helpers/arguments.js'

let validatedEnvVariables = false

// TODO: consider setting these variables in the sake.config on load instead, and validating sake.config vars instead
// validate env variables before deploy
function validateEnvVariables () {
  if (validatedEnvVariables) return

  let variables = ['GITHUB_API_KEY']

  if (sake.config.deploy.type === 'wc') {
    variables = variables.concat(['WC_USERNAME', 'WC_APPLICATION_PASSWORD'])
  }

  if (sake.config.deploy.type === 'wp') {
    variables = variables.concat(['WP_SVN_USER'])
  }

  sake.validateEnvironmentVariables(variables)
}

/**
 * Deploys the plugin, using a specific Git release
 * This differs from {@see deployTask()} in that this task does NOT do any code changes to your working copy.
 * It simply bundles up your code as-is, zips it, uploads it to the release you provided, and deploys it.
 * It's expected that the plugin is already "fully built" at the time you run this.
 */
const deployFromReleaseTask = (done) => {
  validateEnvVariables()

  if (! gitReleaseTag()) {
    sake.throwError('Missing required GitHub release tag')
  }

  // indicate that we are deploying
  sake.options.deploy = true

  let tasks = [
    // clean the build directory
    cleanBuildTask,
    // copy plugin files to the build directory
    copyBuildTask,
    // create the zip, which will be attached to the releases
    zipTask,
    // upload the zip to the release,
    gitHubUploadZipToReleaseTask
  ]

  if (isDryRunDeploy()) {
    tasks.push(function(cb) {
      log.info('Dry run deployment successful')

      return cb()
    })
  } else {
    if (sake.config.deploy.wooId && sake.config.deploy.type === 'wc') {
      tasks.push(promptWcUploadTask)
    }

    if (sake.config.deploy.type === 'wp') {
      tasks.push(deployToWpRepoTask)
    }
  }

  return gulp.series(tasks)(done)
}
deployFromReleaseTask.displayName = 'deploy:git-release'

/**
 * Deploy the plugin
 */
const deployTask = (done) => {
  validateEnvVariables()

  // we only validate if a release hasn't been provided to us
  // if we are provided a release then we have to assume version numbers, etc. have already been adjusted
  if (! hasGitRelease() && ! withoutCodeChanges() && !sake.isDeployable()) {
    sake.throwError('Plugin is not deployable: \n * ' + sake.getChangelogErrors().join('\n * '))
  }

  // indicate that we are deploying
  sake.options.deploy = true
  // ensure scripts and styles are minified
  sake.options.minify = true

  let tasks = [
    // preflight checks, will fail the deploy on errors
    promptTestedReleaseZipTask,
    deployPreflightTask,
    // ensure version is bumped
    bumpTask,
    // fetch the latest WP/WC versions & bump the "tested up to" values
    fetchAndBumpLatestWpWcVersions,
    // prompt for the version to deploy as
    function (cb) {
      if (! isNonInteractive()) {
        return promptDeployTask()
      } else {
        return cb()
      }
    },
    function (cb) {
      if (sake.options.version === 'skip') {
        log.error(chalk.red('Deploy skipped!'))
        return done()
      }
      cb()
    },
    // replace version number & date
    function (cb) {
      if (withoutCodeChanges()) {
        return cb()
      }

      return replaceVersionTask()
    },
    // delete prerelease, if any
    cleanPrereleaseTask,
    // build the plugin - compiles and copies to build dir
    buildTask,
    // ensure the required framework version is installed
    deployValidateFrameworkVersionTask,
    // grab issues to close with commit
    gitHubGetReleaseIssueTask,
    // rebuild plugin configuration (version number, etc)
    function rebuildPluginConfig (cb) {
      sake.buildPluginConfig()
      cb()
    },
    // git commit & push
    function (cb) {
      if (withoutCodeChanges() || isDryRunDeploy()) {
        return cb()
      }

      return shellGitPushUpdateTask()
    },
    // create the zip, which will be attached to the releases
    zipTask,
    // create the release if it doesn't already exist, and attach the zip
    deployCreateReleasesTask
  ]

  if (isDryRunDeploy()) {
    tasks.push(function(cb) {
      log.info('Dry run deployment successful')

      return cb()
    })
  } else {
    if (sake.config.deploy.wooId && sake.config.deploy.type === 'wc') {
      tasks.push(promptWcUploadTask)
    }

    if (sake.config.deploy.type === 'wp') {
      tasks.push(deployToWpRepoTask)
    }
  }

  // finally, create a docs issue, if necessary
  tasks.push(gitHubCreateDocsIssueTask)

  return gulp.series(tasks)(done)
}
deployTask.displayName = 'deploy'

/**
 * Run deploy preflight checks
 */
const deployPreflightTask = (done) => {
  let tasks = [
    shellGitEnsureCleanWorkingCopyTask,
    validateReadmeHeadersTask,
    lintScriptsTask,
    lintStylesTask
  ]

  if (sake.config.deploy.type === 'wc') {
    tasks.unshift(searchWtUpdateKeyTask)
  }

  gulp.parallel(tasks)(done)
}
deployPreflightTask.displayName = 'deploy:preflight'

const deployValidateFrameworkVersionTask = (done) => {
  if (sake.config.framework === 'v5' && sake.getFrameworkVersion() !== sake.getRequiredFrameworkVersion()) {
    sake.throwError('Required framework version in composer.json (' + sake.getRequiredFrameworkVersion() + ') and installed framework version (' + sake.getFrameworkVersion() + ') do not match. Halting deploy.')
  }

  done()
}
deployValidateFrameworkVersionTask.displayName = 'deploy:validate_framework_version'

/**
 * Internal task for making sure the WT updater keys have been set
 */
const searchWtUpdateKeyTask = (done) => {
  fs.readFile(`${sake.config.paths.src}/${sake.config.plugin.mainFile}`, 'utf8', (err, data) => {
    if (err) sake.throwError(err)

    // matches " * Woo: ProductId:ProductKey" in the main plugin file PHPDoc
    const phpDocMatch = data.match(/\s*\*\s*Woo:\s*\d*:(.+)/ig)
    // matches legacy woothemes_queue_update() usage in the main plugin file
    const phpFuncMatch = data.match(/woothemes_queue_update\s*\(\s*plugin_basename\s*\(\s*__FILE__\s*\)\s*,\s*'(.+)'\s*,\s*'(\d+)'\s*\);/ig)

    // throw an error if no WT keys have been found with either method
    if (!phpDocMatch && !phpFuncMatch) {
      sake.throwError('WooThemes updater keys for the plugin have not been properly set ;(')
    }

    done()
  })
}
searchWtUpdateKeyTask.displayName = 'search:wt_update_key'

/**
 * Internal task for replacing the version and date when deploying
 */
const replaceVersionTask = (done) => {
  if (!sake.getVersionBump()) {
    sake.throwError('No version replacement specified')
  }

  const versions = sake.getPrereleaseVersions(sake.getPluginVersion())
  const versionReplacements = versions.map(version => {
    return { match: version, replacement: () => sake.getVersionBump() }
  })

  const filterChangelog = filter('**/{readme.md,readme.txt,changelog.txt}', { restore: true })
  const date = dateFormat(new Date(), 'yyyy.mm.dd')

  let paths = [
    `${sake.config.paths.src}/**/*.php`,
    `${sake.config.paths.src}/readme.md`,
    `${sake.config.paths.src}/readme.txt`,
    `${sake.config.paths.src}/changelog.txt`,
    `!${sake.config.paths.src}/*.json`,
    `!${sake.config.paths.src}/*.xml`,
    `!${sake.config.paths.src}/*.yml`
  ]

  if (fs.existsSync(sake.config.paths.assetPaths.js)) {
    paths.concat([
      `${sake.config.paths.assetPaths.js}/**/*.{coffee,js}`,
      `!${sake.config.paths.assetPaths.js}/**/*.min.js`,
    ])
  }

  if (fs.existsSync(sake.config.paths.assetPaths.css)) {
    paths.concat([
      `${sake.config.paths.assetPaths.css}/**/*.scss`,
      `${sake.config.paths.assetPaths.css}/**/*.css`,
    ])
  }

  if (fs.existsSync(`!${sake.config.paths.src}/lib`)) {
    paths.push(`!${sake.config.paths.src}/lib/**`)
  }

  if (fs.existsSync(`!${sake.config.paths.src}/vendor`)) {
    paths.push(`!${sake.config.paths.src}/vendor/**`)
  }

  if (fs.existsSync(`!${sake.config.paths.src}/tests`)) {
    paths.push(`!${sake.config.paths.src}/tests/**`)
  }

  if (fs.existsSync(`!${sake.config.paths.src}/node_modules`)) {
    paths.push(`!${sake.config.paths.src}/node_modules/**`)
  }

  return gulp.src(paths, { base: './', allowEmpty: true })
    // unlike gulp-replace, gulp-replace-task supports multiple replacements
    .pipe(replaceTask({ patterns: versionReplacements, usePrefix: false }))
    .pipe(filterChangelog)
    .pipe(replace(/[0-9]+\.nn\.nn/, date))
    .pipe(filterChangelog.restore)
    .pipe(gulp.dest('./'))
}
replaceVersionTask.displayName = 'replace:version'

/**
 * Grab any issues to close with the deploy
 */
const getIssuesToCloseTask = (done) => {
  let tasks = [gitHubGetReleaseIssueTask]

  if (sake.config.deploy.type === 'wc') {
    tasks.push(gitHubGetWcIssuesTask)
  }

  gulp.series(tasks)(done)
}
getIssuesToCloseTask.displayName = 'get_issues_to_close'

/**
 * Create releases for a deploy
 *
 * This task is especially useful if your deploy failed before the release
 * creating step or you need to re-create the releases for some reason
 */
const deployCreateReleasesTask = (done) => {
  // TODO: consider using async or similar to hide the anonymous tasks from gulp, see: https://github.com/gulpjs/gulp/issues/1143

  let tasks = [
    function (cb) {
      sake.options.owner = sake.config.deploy.dev.owner
      sake.options.repo = sake.config.deploy.dev.name
      sake.options.prefix_release_tag = sake.config.multiPluginRepo
      cb()
    }
  ]

  if (hasGitRelease()) {
    tasks.push(gitHubUploadZipToReleaseTask)
  } else if (! isDryRunDeploy()) {
    tasks.push(gitHubCreateReleaseTask)
  } else {
    // if it wasn't a dry run we would have created a release
    log.info('Dry run - skipping creation of release')
    return done()
  }

  return gulp.series(tasks)(done)
}
deployCreateReleasesTask.displayName = 'deploy_create_releases'

/**
 * Main task for deploying the plugin after build to the production repo
 * @deprecated
 */
const deployToProductionRepoTask = (done) => {
  let tasks = []

  if (sake.config.deploy.type === 'wc') {
    tasks.push(deployToWcRepoTask)
  } else if (sake.config.deploy.type === 'wp') {
    tasks.push(deployToWpRepoTask)
  } else {
    log.warn(chalk.yellow('No deploy type set, skipping deploy to remote repo'))
    return done()
  }

  gulp.series(tasks)(done)
}
deployToProductionRepoTask.displayName = 'deploy_to_production_repo'

/** WooCommerce repo related tasks ****************************************/

/**
 * Deploy to WC repo
 * @deprecated
 */
const deployToWcRepoTask = (done) => {
  validateEnvVariables()

  gulp.series(copyToWcRepoTask, shellGitPushWcRepoTask)(done)
}
deployToWcRepoTask.displayName = 'deploy_to_wc_repo'

/**
 * Copy to WC repo
 *
 * Helper task which copies files to WC repo (used by {@see updateWcRepoTask()})
 *
 * Builds the plugin, pulls chances from the WC repo, cleans the local WC
 * repo clone, and then copies built plugin to clone
 * @deprecated
 */
const copyToWcRepoTask = (done) => {
  validateEnvVariables()

  let tasks = [
    // copy files to build directory
    buildTask,
    // ensure WC repo is up to date
    shellGitPullWcRepoTask,
    // clean the WC plugin dir
    cleanWcRepoTask,
    // copy files from build to WC repo directory
    copyWcRepoTask,
  ]

  // no need to build when part of deploy process
  if (sake.options.deploy) {
    tasks.shift()
  }

  gulp.series(tasks)(done)
}
copyToWcRepoTask.displayName = 'copy_to_wc_repo'

/**
 * @TODO: do we need this anymore?
 *
 * Update WC repo
 *
 * Builds and copies plugin to WC repo then pushes a general "Updating {plugin name}"
 * commit. This is not a very useful task as it was created many moons ago to allow
 * us to quickly fix issues with the deploy (such as extra files, etc). The
 * task remains for posterity
 * @deprecated
 */
const updateWcRepoTask = (done) => {
  validateEnvVariables()

  gulp.series(copyToWcRepoTask, shellGitUpdateWcRepoTask)(done)
}
updateWcRepoTask.displayName = 'update_wc_repo'

/** WP.org deploy related tasks ****************************************/

const deployToWpRepoTask = (done) => {
  let tasks = [copyToWpRepoTask, shellSvnCommitTrunkTask]

  sake.options = _.merge({
    deployTag: true,
    deployAssets: true
  }, sake.options)

  if (sake.options.deployTag) {
    tasks.push(copyWpTagTask)
    tasks.push(shellSvnCommitTagTask)
  }

  if (sake.options.deployAssets) {
    tasks.push(cleanWpAssetsTask)
    tasks.push(copyWpAssetsTask)
    tasks.push(shellSvnCommitAssetsTask)
  }

  gulp.series(tasks)(done)
}
deployToWpRepoTask.displayName = 'deploy_to_wp_repo'

const copyToWpRepoTask = (done) => {
  let tasks = [
    // copy files to build directory
    buildTask,
    // ensure WP repo is up to date
    shellSvnCheckoutTask,
    // clean the WC plugin dir
    cleanWpTrunkTask,
    // copy files from build to WP repo directory
    copyWpTrunkTask
  ]

  // no need to build when part of deploy process
  if (sake.options.deploy) {
    tasks.shift()
  }

  gulp.series(tasks)(done)
}
copyToWpRepoTask.displayName = 'copy_to_wp_repo'

const fetchLatestWpWcVersionsTask = (done) => {
  log.info('Fetching latest WP and WC versions')

  let requests = []

  // only fetch the latest if a version is specified
  // this allows us to set to a version that isn't yet released
  if (!sake.options.tested_up_to_wp_version) {
    requests.push(
      axios.get('https://api.wordpress.org/core/version-check/1.7/')
        .then(res => {
          sake.options.tested_up_to_wp_version = res.data.offers[0].version
        })
    )
  }

  if (sake.config.platform === 'wc' && !sake.options.tested_up_to_wc_version) {
    requests.push(
      axios.get('https://api.wordpress.org/plugins/info/1.0/woocommerce.json')
        .then(res => {
          if (res.data.error) {
            throw res.data.error
          }

          sake.options.tested_up_to_wc_version = res.data.version
        })
    )
  }

  axios.all(requests)
    .then(() => done())
    .catch(err => sake.throwDeferredError('An error occurred when fetching latest WP / WC versions: ' + err.toString()))
}
fetchLatestWpWcVersionsTask.displayName = 'fetch_latest_wp_wc_versions'

const fetchAndBumpLatestWpWcVersions = gulp.series(fetchLatestWpWcVersionsTask, bumpMinReqsTask)
fetchAndBumpLatestWpWcVersions.displayName = 'fetch_and_bump_latest_wp_wc_versions'

export {
  deployFromReleaseTask,
  deployTask,
  deployPreflightTask,
  deployValidateFrameworkVersionTask,
  searchWtUpdateKeyTask,
  replaceVersionTask,
  getIssuesToCloseTask,
  deployCreateReleasesTask,
  deployToProductionRepoTask,
  deployToWcRepoTask,
  copyToWcRepoTask,
  updateWcRepoTask,
  deployToWpRepoTask,
  copyToWpRepoTask,
  fetchLatestWpWcVersionsTask,
  fetchAndBumpLatestWpWcVersions
}
