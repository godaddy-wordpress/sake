'use strict'

const gulp = require('gulp')
const path = require('path')
const minimist = require('minimist')
const log = require('fancy-log')
const _ = require('lodash')
const ForwardReference = require('undertaker-forward-reference')

// enable forward-referencing tasks, see https://github.com/gulpjs/gulp/issues/1028
gulp.registry(ForwardReference())

// define default config
let defaults = {
  // whether to minify JS and CSS or not
  minify: false, // TODO: set based on env variable or task (deploy)
  paths: {
    // this feels wrong, as the assets are actually based on src
    src: 'src',
    assets: 'assets',
    css: 'assets/css',
    js: 'assets/js',
    images: 'assets/img',
    fonts: 'assets/fonts',
    build: 'build'
  },
  tasks: {
    makepot: {
      reportBugsTo: ''
    },
    watch: {
      useBrowserSync: false
    }
  },
  // which framework version this plugin uses - valid values: 'v5', 'v4', or pass boolean `false` to indicate a non-frameworked plugin
  framework: 'v5'
}

// load local configuration
// TODO: allow passing in config file path or config as string (for multi-plugin repos?)
let localConfig = {}

try {
  localConfig = require(path.join(process.cwd(), 'sake.config.js'))
} catch (e) {
  log.warn('Could not find local config file, using default config values.')
}

let config = _.merge(defaults, localConfig)
let options = minimist(process.argv.slice(2), {})

const util = require('./lib/utilities')(config, options)

util.parseOptions()
util.buildPluginConfig()
util.loadConfig()
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
