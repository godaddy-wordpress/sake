const fs = require('fs')
const log = require('fancy-log')
const dateFormat = require('dateformat')

module.exports = (gulp, config, plugins, options, pipes) => {
  const util = require('../lib/utilities')(config, options)

  let validatedEnvVariables = false

  // TODO: consider setting these variables in the config on load instead, and validating config vars instead
  // validate env variables before deploy
  function validateEnvVariables () {
    if (validatedEnvVariables) return

    let errors = []

    if (!process.env.GITHUB_USERNAME) {
      errors.push('GITHUB_USERNAME not set')
    }

    if (!process.env.GITHUB_API_KEY) {
      errors.push('GITHUB_API_KEY not set')
    }

    if (config.deployType === 'wc') {
      if (!process.env.WT_REPOS_PATH) {
        errors.push('WT_REPOS_PATH not set')
      }

      let reposPath = util.resolvePath(process.env.WT_REPOS_PATH)

      if (!fs.existsSync(reposPath)) {
        errors.push(`WT_REPOS_PATH is invalid - the path '${reposPath}' does not exist`)
      }
    }

    if (errors.length) {
      let err = new Error('Environment variables missing or invalid: \n * ' + errors.join('\n * '))
      err.showStack = false
      throw err
    }

    validatedEnvVariables = true
  }

  // deploy the plugin
  gulp.task('deploy', (done) => {
    validateEnvVariables()

    if (!util.isDeployable()) {
      let err = new Error('Plugin is not deployable: \n * ' + util.getChangelogErrors().join('\n * '))
      err.showStack = false
      throw err
    }

    // indicate that we are deploying
    options.deploy = true
    // ensure scripts and styles are minified
    options.minify = true

    return gulp.series([
      // preflight checks, will fail the deploy on errors
      'deploy:preflight',
      // ensure version is bumped
      'bump',
      // prompt for the version to deploy as
      'prompt:deploy',
      function (cb) {
        if (config.deploys.version === 'skip') {
          log.warn('Deploy skipped!')
          return done()
        }
        cb()
      },
      // replace version number & date
      'replace:version',
      // delete prerelease, if any
      'clean:prerelease',
      // build the plugin - compiles and copies to build dir
      'build',
      // grab issue to close with commit
      'github:get_rissue',
      // git commit & push
      'shell:git_push_update',
      // deploy to 3rd party repo
      'deploy_to_remote_repo',
      // rebuild plugin options
      function rebuildPluginConfig (cb) {
        util.buildPluginConfig()
        cb()
      },
      // create the zip, which will be attached to the releases
      'compress',
      // create releases, attaching the zip
      'deploy_create_releases',
      // create a docs issue, if necessary
      'github:docs_issue'
    ])(done)
  })

  // run deploy preflight checks
  gulp.task('deploy:preflight', (done) => {
    let tasks = [
      'shell:git_ensure_clean_working_copy',
      'scripts:lint',
      'styles:lint'
    ]

    if (config.deployType === 'wc') {
      tasks.unshift('search:wt_update_key')
    }

    gulp.parallel(tasks)(done)
  })

  // internal task for making sure the WT updater keys have been set
  gulp.task('search:wt_update_key', (done) => {
    fs.readFile(`${config.paths.src}/${config.plugin.mainFile}`, 'utf8', (err, data) => {
      if (err) {
        throw new Error(err)
      }

      let results = data.match(/woothemes_queue_update\s*\(\s*plugin_basename\s*\(\s*__FILE__\s*\)\s*,\s*'(.+)'\s*,\s*'(\d+)'\s*\);/ig)

      if (!results) {
        throw new Error('WooThemes updater keys for the plugin have not been properly set ;(')
      }

      done()
    })
  })

  // internal task for replacing version and date when deploying
  gulp.task('replace:version', () => {
    if (!config.deploys || !config.deploys.version) {
      throw new Error('No version specified')
    }

    // maybe use gulp replace task instead?
    const versions = util.getPrereleaseVersions(util.getPluginVersion())
    const replacements = versions.map(version => {
      return { match: version, replacement: () => util.getVersionBump() }
    })

    const filter = plugins.filter('**/{readme.txt,changelog.txt}', { restore: true })
    const date = dateFormat(new Date(), 'yyyy.mm.dd')

    return gulp.src([
      `${config.paths.src}/**/*.php`,
      `${config.paths.src}/readme.txt`,
      `${config.paths.src}/changelog.txt`,
      `${config.paths.assetPaths.js}/**/*.{coffee,js}`,
      `!${config.paths.assetPaths.js}/**/*.min.js`,
      `${config.paths.assetPaths.css}/**/*.scss`,
      `${config.paths.assetPaths.css}/**/*.css`,
      `!${config.paths.src}/lib/**`,
      `!${config.paths.src}/vendor/**`,
      `!${config.paths.src}/tests/**`,
      `!${config.paths.src}/node_modules/**`,
      `!${config.paths.src}/*.json`,
      `!${config.paths.src}/*.xml`,
      `!${config.paths.src}/*.yml`
    ], { base: './' })
      // unlike gulp-replace, gulp-replace-task supports multiple replacements
      .pipe(plugins.replaceTask({ patterns: replacements, usePrefix: false }))
      .pipe(filter)
      .pipe(plugins.replace('XXXX.XX.XX', date))
      .pipe(plugins.replace(/[0-9]+\.nn\.nn/, date))
      .pipe(filter.restore)
      .pipe(gulp.dest('./'))
  })

  /**
   * Create releases for a deploy
   *
   * This task is especially useful if your deploy failed before the release
   * creating step or you need to re-create the releases for some reason
   */
  gulp.task('deploy_create_releases', (done) => {
    // TODO: consider using async or similar to hide the anonymous tasks from gulp, see: https://github.com/gulpjs/gulp/issues/1143

    let tasks = [
      function (cb) {
        options.owner = config.deploys.github.internal.owner
        options.repo = config.deploys.github.internal.repo
        cb()
      },
      'github:create_release'
    ]

    if (config.deployType === 'wc' && config.deploys.github.external) {
      tasks = tasks.concat([
        function (cb) {
          options.owner = config.deploys.github.external.owner
          options.repo = config.deploys.github.external.repo
          cb()
        },
        'github:create_release'
      ])
    }

    return gulp.series(tasks)(done)
  })

  // main task for deploying the plugin after build to the remote 3rd party repo
  gulp.task('deploy_to_remote_repo', (done) => {
    let tasks = []

    // TODO: add a sanity check here to verify that the build dir is not empty

    if (config.deployType === 'wc') {
      tasks.push('deploy_to_wc_repo')
    } else if (config.deployType === 'wp') {
      tasks.push('deploy_to_wp_repo')
    } else {
      log.warn('No deploy type set, skipping deploy to remote repo')
    }

    gulp.series(tasks)(done)
  })

  /** WooCommerce repo related tasks ****************************************/

  // deploy to WC repo
  gulp.task('deploy_to_wc_repo', (done) => {
    validateEnvVariables()

    gulp.series('copy_to_wc_repo', 'shell:git_push_wc_repo')(done)
  })

  /**
   * Copy to WC repo
   *
   * Helper task which copies files to WC repo (used by update_wc_repo)
   *
   * Builds the plugin, pulls chances from the WC repo, cleans the local WC
   * repo clone, and then copies built plugin to clone
   */
  gulp.task('copy_to_wc_repo', (done) => {
    validateEnvVariables()

    let tasks = [
      // copy files to build directory
      'build',
      // ensure WC repo is up to date
      'shell:git_pull_wc_repo',
      // clean the WC plugin dir
      'clean:wc_repo',
      // copy files from build to WC repo directory
      'copy:wc_repo'
    ]

    // no need to build when part of deploy process
    if (!options.deploy) {
      tasks.shift()
    }

    gulp.series(tasks)(done)
  })

  // TODO: do we need this anymore?
  /**
   * Update WC repo
   *
   * Builds and copies plugin to WC repo then pushes a general "Updating {plugin name}"
   * commit. This is not a very useful task as it was created many moons ago to allow
   * us to quickly fix issues with the deploy (such as extra files, etc). The
   * task remains for posterity
   */
  gulp.task('update_wc_repo', (done) => {
    validateEnvVariables()

    gulp.series('copy_to_wc_repo', 'shell:git_update_wc_repo')(done)
  })

  /** WP.org deploy related tasks ****************************************/

  gulp.task('deploy_to_wp_repo', (done) => {
    log.warn('__NOT IMPLEMENTED__')
    done()
  })
}
