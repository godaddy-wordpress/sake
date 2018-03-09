'use strict'

const fs = require('fs')
const path = require('path')
const semver = require('semver')
const _ = require('lodash')
const _str = require('underscore.string')

module.exports = (config, options) => {
  const exports = {}

  // Uglify tasks - an array of strings denoting the name of the uglify tasks
  exports.uglifyDevTasks = []
  exports.uglifyPluginTasks = {}

  exports.loadConfig = function () {
    let configPath = path.join(__dirname, '../config')

    fs.readdirSync(configPath).forEach((file) => {
      let key = file.replace(/\.js$/, '')
      config.tasks[key] = require(path.join(configPath, file))(config, options)
    })
  }

  exports.loadPipes = function (plugins) {
    let pipePath = path.join(__dirname, '../pipes')
    let pipes = {}

    fs.readdirSync(pipePath).forEach((file) => {
      pipes = _.extend(pipes, require(path.join(pipePath, file))(config, plugins, options))
    })

    return pipes
  }

  exports.buildPluginConfig = function () {
    let changelog = this.parseChangelog()

    // generate shorthand asset paths
    config.paths.assetPaths = {
      css: `./${config.paths.src}/${config.paths.css}`,
      js: path.join('./', config.paths.src, config.paths.js),
      images: `./${config.paths.src}/${config.paths.images}`,
      fonts: `./${config.paths.src}/${config.paths.fonts}`
    }

    // generate framework paths
    if (config.framework) {
      config.paths.framework = _.merge({
        base: config.framework === 'v5' ? 'vendor/skyverge/wc-plugin-framework' : 'lib/skyverge',
        general: {
          css: 'woocommerce/assets/css',
          js: 'woocommerce/assets/js'
        },
        gateway: {
          css: 'woocommerce/payment-gateway/assets/css',
          js: '/woocommerce/payment-gateway/assets/js'
        }
      }, config.paths.framework)
    }

    config.plugin = {
      name: changelog.plugin_name,
      slug: path.basename(process.cwd()),
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

    if (config.framework) {
      config.plugin.frameworkVersion = this.getFrameworkVersion()
    }
  }

  exports.getMainPluginFile = function (fullpath) {
    let abspath = process.cwd()
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
    let mainPluginFile = exports.getMainPluginFile(true)

    if (mainPluginFile) {
      return fs.readFileSync(mainPluginFile, 'utf8').match(/['"]is_payment_gateway['"]\s*=>\s*true/)
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

  exports.parseChangelog = function () {
    let changelogPath = path.join(process.cwd(), 'changelog.txt')
    let changelog = {
      plugin_name: '',
      plugin_version: '',
      changes: []
    }

    if (fs.existsSync(changelogPath)) {
      let lines = fs.readFileSync(changelogPath, 'utf8').split('\n')

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
          changelog.plugin_version = lines[i].substr(lines[i].indexOf('version') + 8).trim()
        }

        // get the plugin name
        if (changelog.plugin_name === '' && lines[i].indexOf('***') !== -1) {
          changelog.plugin_name = lines[i].replace(/\*/g, '').replace(/Changelog/, '').trim()
        }
      }
    }

    return changelog
  }

  exports.getFrameworkVersion = function () {
    let changelogPath = path.join(process.cwd(), config.paths.framework.base, 'woocommerce/changelog.txt')
    let version = ''

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

    return version
  }

  exports.buildDeployOptions = function () {
    let version = this.getPluginVersion()

    if (!options.deploys) {
      options.deploys = {}
    }

    options.deploys.version_prerelease = version
    options.deploys.version = version.split('-').shift()
    options.deploys.name = this.getPluginName()
    options.deploys.wc_repo = config.plugin.wc_repo
  }

  exports.isDeployable = function () {
    return !this.getChangelogErrors().length
  }

  exports.getChangelogErrors = function () {
    const errors = []

    let version = this.getPluginVersion()

    if (!version || version.indexOf('-') === -1 || !semver.valid(version)) {
      errors.push(`Plugin version ${version} is not a valid version for deploy`)
    }

    if (!config.plugin.changes.length) {
      errors.push(`No changes listed in changelog`)
    }

    // TODO: consider validating whether the prerelase version is appropriate for the changes
    // listed in changelog, ie if there are only fixes in the release, the version should be
    // a patch version, if there are features, it should be a minor or major release, etc {IT 2018-03-09}

    return errors
  }

  exports.getVersionBump = function () {
    if (options.version_bump) {
      return options.version_bump
    }

    let bump = config.deploys.version

    if (bump === 'custom') {
      bump = config.deploys.version_custom
    }

    // some tasks only work with the general template -- looking at you github-releaser
    config.deploys.version_bump = bump

    return bump
  }

  exports.getDefaultIncrement = function () {
    let inc = 'patch'

    if (_str.include(config.plugin.changes.join('\n', '* Feature '))) {
      inc = 'minor'
    }

    return inc
  }

  exports.getWCRepoPath = function () {
    return this.resolvePath(process.env.WT_REPOS_PATH + '/' + config.plugin.wc_repo + '/')
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

  // TODO: consider if a task itself should parse it's options?
  exports.parseOptions = () => {
    // helper to determine if a number is an integer
    let isInt = (n) => {
      return n % 1 === 0
    }

    // semver-ify versions passed in as integers
    ['minimum_wp_version', 'tested_up_to_wp_version', 'minimum_wc_version', 'tested_up_to_wc_version', 'framework_version', 'backwards_compatible'].forEach((option) => {
      if (options[option] && isInt(options[option])) {
        options[option] = parseFloat(options[option]).toFixed(1)
      }
    })
  }

  return exports
}
