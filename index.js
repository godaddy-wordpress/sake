'use strict'

const gulp = require('gulp')
const path = require('path')
const fs = require('fs')
const minimist = require('minimist')
const log = require('fancy-log')
const _ = require('lodash')
const ForwardReference = require('undertaker-forward-reference')

// local .env file, overriding any global env variables
if (fs.existsSync('.env')) {
  let result = require('dotenv').config()

  log.warn('Loading ENV variables from .env file')

  for (let k in result.parsed) {
    process.env[k] = result.parsed[k]
  }
}

// development .env file, overriding any global env variables, or repo/plugin specific variables
let devEnv = path.join(__dirname, '.env')
if (fs.existsSync(devEnv)) {
  let result = require('dotenv').config({path: devEnv})

  log.warn('LOADING DEVELOPMENT ENV VARIABLES FROM ' + devEnv)

  for (let k in result.parsed) {
    process.env[k] = result.parsed[k]
  }
}

// enable forward-referencing tasks, see https://github.com/gulpjs/gulp/issues/1028
gulp.registry(ForwardReference())

// define default config
let defaults = {
  // all the paths
  paths: {
    src: '.',
    // this feels wrong, as the assets are actually based on src
    assets: 'assets',
    css: 'assets/css',
    js: 'assets/js',
    images: 'assets/img',
    fonts: 'assets/fonts',
    build: 'build',
    tmp: '/tmp'
  },
  // task-specific configuration
  tasks: {
    makepot: {
      reportBugsTo: 'https://woocommerce.com/my-account/marketplace-ticket-form/'
    },
    watch: {
      useBrowserSync: process.env.USE_BROWSERSYNC || false
    },
    browserSync: {
      url: process.env.BROWSERSYNC_URL || 'plugins-skyverge.test'
    }
  },
  // which framework version this plugin uses - valid values: 'v5', 'v4', or pass boolean `false` to indicate a non-frameworked plugin
  framework: 'v5',
  deploy: {
    // which deploy type does this plugin use - either 'wc' or 'wp', defaults to 'wc', specify `null` for no automated deploy
    type: 'wc'
  }
}

// load local configuration
// TODO: allow passing in config file path or config as string (for multi-plugin repos?)
let localConfig = {}

// support supplying a single / parent config file in multi-plugin repos
let parentConfigPath = path.join(process.cwd(), '../sake.config.js')
let found = false

if (fs.existsSync(parentConfigPath)) {
  log.warn('Found config file in parent folder')
  localConfig = require(parentConfigPath)
  found = true
}

// load local, plugin-specific config file
let configFilePath = path.join(process.cwd(), 'sake.config.js')

if (fs.existsSync(configFilePath)) {
  localConfig = _.merge(localConfig, require(configFilePath))
  found = true
}

if (!found) {
  log.warn('Could not find local config file, using default config values.')
}

let config = _.merge(defaults, localConfig)

// parse CLI options
let options = minimist(process.argv.slice(2), {
  boolean: ['minify'],
  default: {
    minify: false
  }
})

const util = require('./lib/utilities')(config, options)

util.parseConfig()
util.buildDeployOptions()

let plugins = require('gulp-load-plugins')()

// Attach browsersync as a plugin - not really a plugin, but it helps to
// pass around the browsersync instance between tasks. Unfortunately, we
// always have to load and create an instance of it, because gulp-if does not
// support lazy evaluation yet: https://github.com/robrich/gulp-if/issues/75
plugins.browserSync = require('browser-sync').create()

const pipes = util.loadPipes(plugins) // load reusable pipes

// attach CLI options to config - config should be the only thing passed around
// even gulp or plugins can be loaded by tasks themselves
// but how can we pass around util? basically helper functions? do we require them when needed,
// or create some kind of class "Sake" that is passed around and contains all the utiulity methods?
// How can I make sure that util tasks that depend on
//
// sake.init() =>
// sake.loadConfig()
// sake.buildPluginConfig()
// sake.buildDeployConfig()
// sake.parseCliOptions()
// sake.loadGulpPlugins()
// sake.loadGulpTasks()
// sake.util.getVersionBump()

// load gulp plugins and tasks
require('fs').readdirSync(path.join(__dirname, 'tasks')).forEach((file) => {
  require(path.join(__dirname, 'tasks', file))(gulp, config, plugins, options, pipes)
})

gulp.task('default', gulp.series('compile'))

// show notification on task errors
const notifier = require('node-notifier')
const stripAnsi = require('strip-ansi')
let loggedErrors = []

gulp.on('error', (event) => {
  if (loggedErrors.indexOf(event.error) === -1) {
    notifier.notify({
      title: `Error running task ${event.name}`,
      message: stripAnsi(event.error.toString()),
      sound: 'Frog'
    })

    // ensure the same error is only displayed once
    loggedErrors.push(event.error)
  }
})
