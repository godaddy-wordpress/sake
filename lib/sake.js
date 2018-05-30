const fs = require('fs')
const path = require('path')
const semver = require('semver')
const parseGitConfig = require('parse-git-config')
const parseGitHubUrl = require('parse-github-url')
const _ = require('lodash')
const _str = require('underscore.string')
const log = require('fancy-log')
const chalk = require('chalk')
const dottie = require('dottie')

module.exports = (config, options) => {
  const exports = {}
  // current task(s) from CLI, ie for `npx sake clean build` this will result in ['clean', 'build']
  const cliTasks = process.argv.slice(2, -4)
  // whitelist of repo-level tasks
  const repoLevelTasks = ['github:create_release_milestones', 'github:create_month_milestones']
  // determine if the tasks being called from CLI contain only repo-level tasks or not
  const isRunningRepoLevelTasks = cliTasks.every((task) => repoLevelTasks.indexOf(task) > -1)

  exports.config = config
  exports.options = options

  // initialize configuration
  // TODO: consider making most of these methods private {IT 2018-03-21}
  exports.initConfig = function () {
    this.buildPluginConfig()
    this.buildPaths()
    this.buildFrameworkConfig()
    this.buildDeployConfig()

    // this will be set to true by the watch task when needed
    this.isWatching = false
  }

  // set up plugin config, like name, id, versions, main file location
  exports.buildPluginConfig = function () {
    let changelog = this.parseChangelog()

    config.plugin = {
      name: changelog.plugin_name,
      id: (config.plugin && config.plugin.id) ? config.plugin.id : path.basename(process.cwd()),
      changes: changelog.changes,
      version: {
        current: changelog.plugin_version,
        prerelease: semver.inc(changelog.plugin_version, 'prerelease'),
        patch: semver.inc(changelog.plugin_version, 'patch'),
        minor: semver.inc(changelog.plugin_version, 'minor'),
        major: semver.inc(changelog.plugin_version, 'major')
      },
      mainFile: exports.getMainPluginFile()
    }

    // ensure sake is being run inside a plugin directory, unless this is a multi-plugin repo and a repo-level task is being run
    if ((!config.multiPluginRepo || !isRunningRepoLevelTasks) && !config.plugin.mainFile) {
      log.error(chalk.red('Not a plugin directory'))
      process.exit(1)
    }
  }

  // set up plugin paths
  exports.buildPaths = function () {
    // generate shorthand asset paths
    config.paths.assetPaths = {
      css: `${config.paths.src}/${config.paths.css}`,
      js: `${config.paths.src}/${config.paths.js}`,
      images: `${config.paths.src}/${config.paths.images}`,
      fonts: `${config.paths.src}/${config.paths.fonts}`
    }

    // a little helper to keep things DRY
    config.paths.assetPaths.javascriptSources = [
      `${config.paths.assetPaths.js}/**/*.js`,
      `!${config.paths.assetPaths.js}/**/*.min.js`,
      `!${config.paths.assetPaths.js}/vendor/*.min.js`
    ]

    // exclude JS vendor paths from javascript sources
    if (config.paths.jsVendor) {
      let vendors = typeof config.paths.jsVendor === 'string' ? [config.paths.jsVendor] : config.paths.jsVendor
      vendors.forEach((vendor) => {
        config.paths.assetPaths.javascriptSources.push(`!${config.paths.assetPaths.js}/${vendor}/**/*.js`)
      })
    }

    // determine build path
    if (config.multiPluginRepo) {
      config.paths.build = path.join('..', config.paths.build)
    }

    // load composer config
    let composerPath = path.join(process.cwd(), 'composer.json')

    if (fs.existsSync(composerPath)) {
      config.composer = require(composerPath)
      config.paths.vendor = dottie.get(config.composer, 'config.vendor-dir') || 'vendor'
    }
  }

  exports.buildFrameworkConfig = function () {
    if (config.framework) {
      // generate framework paths

      // try to determine the framework path based on composer config
      if (config.composer && !dottie.exists(config, 'paths.framework.base')) {
        // any custom installer paths?
        let installerPaths = dottie.get(config.composer, 'extra.installer-paths')
        // is there a custom path for the framework?
        let customFrameworkPath = _.findKey(installerPaths, (item) => item.indexOf('skyverge/wc-plugin-framework') > -1)
        // remove the `src` from the custom path
        let frameworkPath = (customFrameworkPath || path.join(config.paths.vendor, 'skyverge/wc-plugin-framework')).replace(config.paths.src + '/', '')

        dottie.set(config, 'paths.framework.base', frameworkPath)
      }

      config.paths.framework = _.merge({
        base: config.framework === 'v5' ? 'vendor/skyverge/wc-plugin-framework' : 'lib/skyverge',
        general: {
          css: 'woocommerce/assets/css',
          js: 'woocommerce/assets/js'
        },
        gateway: {
          css: 'woocommerce/payment-gateway/assets/css',
          js: 'woocommerce/payment-gateway/assets/js'
        }
      }, config.paths.framework)

      config.plugin.frameworkVersion = this.getFrameworkVersion()

      if (config.framework === 'v5') {
        config.plugin.requiredFrameworkVersion = this.getRequiredFrameworkVersion()
      }
    }
  }

  // set up config for deployments
  exports.buildDeployConfig = function () {
    // parse and expand a repo configuration
    let parseRepoConfig = (input, env, deployType) => {
      let repo = {}

      if (input.indexOf('github') > -1) {
        // we seem to have a github url
        let remote = parseGitHubUrl(input)
        repo.url = input
        repo.owner = remote.owner
        repo.name = remote.name
      } else if (env === 'production' && deployType === 'wp') {
        // looks like we have an svn repo url or slug
        repo.url = input.indexOf('://') > -1 ? input : `http://plugins.svn.wordpress.org/${input}`
        repo.user = process.env.WP_SVN_USER || 'SkyVerge'
        repo.name = input.indexOf('://') > -1 ? input.split('/').pop() : input
      } else if (input.indexOf('/') > -1) {
        // looks like we have a partial github url
        let remote = parseGitHubUrl(input)
        repo.url = `git@github.com:${input}`
        repo.owner = remote.owner
        repo.name = remote.name
      } else {
        // we seem to be dealing with just the github repo slug, we'll assume owner based on the environment
        repo.owner = env === 'production' ? 'woocommerce' : 'skyverge'
        repo.name = input
        repo.url = `git@github.com:${repo.owner}/${input}`
      }

      return repo
    }

    // expand deploy configuration
    if (!_.isObject(config.deploy)) {
      config.deploy = {
        type: config.deploy
      }
    }

    // if deploy repo is set, but no deploy type is set, default to 'wc'
    if (config.deploy && typeof config.deploy.type === 'undefined') {
      config.deploy.type = 'wc'
    }

    // `dev` represents the development repo for this plugin. We'll try to determine the repo from the following values (in order):
    // - DEPLOY_DEV env variable
    // - deploy.dev value from sake.config.js
    // - remote repo url from the local git config
    // - plugin ID
    let devInput = process.env.DEPLOY_DEV || dottie.get(config, 'deploy.dev') || this.getGitRemoteUrl(path.join(process.cwd(), config.multiPluginRepo ? '../' : '')) || config.plugin.id
    config.deploy.dev = parseRepoConfig(devInput, 'dev')

    // only set production config when deploy type is set
    if (config.deploy.type) {
      // `production` represents the production repo for this plugin, which can be eitehr a github or WP SVN repo. We'll try to determine the repo from the following values (in order):
      // - DEPLOY_PRODUCTION env variable
      // - deploy.repo value from sake.config.js
      // - deploy.production value from sake.config.js
      // - plugin ID
      let productionInput = process.env.DEPLOY_PRODUCTION || dottie.get(config, 'deploy.production') || dottie.get(config, 'deploy.repo') || config.plugin.id
      config.deploy.production = parseRepoConfig(productionInput, 'production', config.deploy.type)

      // ensure wp-assets path is set
      if (config.deploy.type === 'wp' && !config.paths.wpAssets) {
        config.paths.wpAssets = 'wp-assets'
      }
    }

    // thou shalt not be needed anymore
    delete config.deploy.repo
  }

  exports.getMainPluginFile = function (fullpath) {
    let abspath = path.join(process.cwd(), config.paths.src)
    let found = false

    fs.readdirSync(abspath).forEach(function (filename) {
      if (path.extname(filename) === '.php' && fs.readFileSync(abspath + '/' + filename, 'utf8').match(/Plugin Name:/)) {
        found = abspath + '/' + filename
      }
    })

    if (found && !fullpath) {
      found = path.basename(found)
    }

    return found
  }

  exports.isFrameworkedPaymentGateway = function () {
    if (!config.framework) {
      return false
    }

    let mainPluginFile = exports.getMainPluginFile(true)

    if (mainPluginFile) {
      let contents = fs.readFileSync(mainPluginFile, 'utf8')
      if (config.framework === 'v5') {
        return contents.match(/SV_WC_Payment_Gateway_Plugin/)
      } else {
        return contents.match(/['"]is_payment_gateway['"]\s*=>\s*true/)
      }
    }

    return false
  }

  exports.getPluginVersion = function (release) {
    release = release || 'current'

    return config.plugin.version[ release ]
  }

  exports.getPrereleaseVersions = function (version) {
    let devVersions = []

    if (version.indexOf('-') !== -1) {
      let prodVersion = version.split('-').shift()
      let devInc = version.split('.').pop()

      for (let i = devInc; i >= 1; i--) {
        // add potential dev versions to the array
        devVersions.push(prodVersion + '-dev.' + i)
        devVersions.push(prodVersion + '-beta.' + i)
        devVersions.push(prodVersion + '-RC.' + i)
        devVersions.push(prodVersion + '-rc.' + i)
      }
    }

    return devVersions
  }

  exports.getPluginName = function (nowc) {
    // default to no "WooCommerce"
    if (undefined === nowc) {
      nowc = true
    }

    return nowc ? config.plugin.name.replace('WooCommerce ', '') : config.plugin.name
  }

  exports.readChangelog = function () {
    let content = this.getPluginName() + ' Changelog \n'

    content += this.getPluginChanges()

    return content
  }

  exports.getPluginChanges = function () {
    return config.plugin.changes.join('\n')
  }

  exports.pluginHasNewFeatures = function () {
    return config.plugin.changes.some((change) => {
      let type = change.split('-')[0].replace(/\*/g, '').trim()
      return type.match(/feature|tweak/ig)
    })
  }

  exports.parseChangelog = function () {
    let filePath = ''

    // check which txt file exists
    let fileName = ['changelog.txt', 'readme.txt'].find((file) => {
      filePath = path.join(process.cwd(), config.paths.src, file)

      return fs.existsSync(filePath)
    })

    let changelog = {
      plugin_name: '',
      plugin_version: '',
      changes: []
    }

    if (fileName) {
      let contents = fs.readFileSync(filePath, 'utf8')
      let lines = []

      if (fileName === 'changelog.txt') {
        lines = contents.split('\n')
      } else {
        lines = contents.split('== Changelog ==')[1].trim().split('\n')
      }

      // get the plugin name from changelog - asuuming it will be on the 1st line
      if (fileName === 'changelog.txt') {
        changelog.plugin_name = lines[0].replace(/\*/g, '').replace(/Changelog/, '').trim()
      } else {
        changelog.plugin_name = contents.split('\n')[0].replace(/=/g, '').trim()
      }

      for (let i = 0; i < lines.length; i++) {
        // get any changes
        if (changelog.plugin_name !== '' && changelog.plugin_version !== '') {
          if (lines[i].trim() !== '') {
            changelog.changes.push(lines[i].trim())
          } else {
            break
          }
        }

        // get the current plugin version
        if (changelog.plugin_version === '' && lines[i].indexOf('version') !== -1) {
          changelog.plugin_version = lines[i].substr(lines[i].indexOf('version') + 8).replace(/=/g, '').trim()
        }
      }
    }

    return changelog
  }

  /**
   * Gets the currently installed framework version for the plugin.
   *
   * @return string
   */
  exports.getFrameworkVersion = function () {
    let version = ''

    if (config.framework === 'v5') {
      let packagePath = path.join(process.cwd(), config.paths.src, config.paths.framework.base, 'package.json')

      if (fs.existsSync(packagePath)) {
        version = require(packagePath).version
      }
    } else {
      let changelogPath = path.join(process.cwd(), config.paths.src, config.paths.framework.base, 'woocommerce/changelog.txt')

      if (fs.existsSync(changelogPath)) {
        let lines = fs.readFileSync(changelogPath, 'utf8').split('\n')

        for (let i = 0; i < lines.length; i++) {
          // get the current plugin version
          if (version === '' && lines[i].indexOf('version') !== -1) {
            version = lines[i].substr(lines[i].indexOf('version') + 8).trim()
            break
          }
        }
      }
    }

    return version
  }

  /**
   * Gets the required framework version for the plugin.
   *
   * @return string
   */
  exports.getRequiredFrameworkVersion = function () {
    return dottie.get(config, 'composer.require.skyverge/wc-plugin-framework')
  }

  exports.isDeployable = function () {
    return !this.getChangelogErrors().length
  }

  exports.getChangelogErrors = function () {
    const errors = []

    let version = this.getPluginVersion()

    if (!version || version.indexOf('-dev.') === -1 || !semver.valid(version)) {
      errors.push(`Plugin version ${version} is not a valid version for deploy`)
    }

    if (!config.plugin.changes.length) {
      errors.push('No changes listed in changelog')
    }

    // TODO: consider validating whether the prerelease version is appropriate for the changes
    // listed in changelog, ie if there are only fixes in the release, the version should be
    // a patch version, if there are features, it should be a minor or major release, etc {IT 2018-03-09}
    return errors
  }

  exports.getVersionBump = function () {
    if (options.version_bump) {
      return options.version_bump
    }

    let bump = options.version

    if (bump === 'custom') {
      bump = options.version_custom
    }

    return bump
  }

  exports.getDefaultIncrement = function () {
    let inc = 'patch'

    if (_str.include(config.plugin.changes.join('\n', '* Feature '))) {
      inc = 'minor'
    }

    return inc
  }

  exports.getGitRemoteUrl = function (repoPath) {
    let gitPath = path.join(repoPath, '.git/config')
    let gitConfig = parseGitConfig.sync({ path: gitPath })

    return dottie.get(gitConfig, 'remote "origin".url') || null
  }

  exports.getProductionRepoPath = function () {
    return path.join(config.paths.tmp, config.deploy.production.name)
  }

  exports.getPrereleasesPath = function () {
    return this.resolvePath(process.env.DROPBOX_PATH + '/skyverge-prereleases/')
  }

  exports.normalizePath = function (p) {
    return path.normalize(p)
  }

  exports.resolvePath = function (p) {
    if (p.substr(0, 2) === '~/') {
      p = (process.env.HOME || process.env.HOMEPATH || process.env.HOMEDIR || process.cwd()) + p.substr(1)
    }

    return this.tailingSlashPath(path.resolve(p))
  }

  exports.tailingSlashPath = function (p) {
    return path.normalize(p + '/')
  }

  exports.validateEnvironmentVariables = (variables) => {
    let errors = []

    variables.forEach((variable) => {
      if (!process.env[variable]) {
        errors.push(`${variable} not set`)
      }
    })

    if (errors.length) {
      let err = new Error('Environment variables missing or invalid: \n * ' + errors.join('\n * '))
      err.showStack = false
      throw err
    }
  }

  // helper to throw an error without stack trace in gulp
  exports.throwError = (message) => {
    let err = new Error(chalk.red(message))
    err.showStack = false
    throw err
  }

  return exports
}
