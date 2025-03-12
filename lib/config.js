import path from 'node:path'
import fs from 'node:fs'
import log from 'fancy-log'
import _ from 'lodash'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url);

const buildSakeConfig = () => {
  // define default config
  let defaults = {
    // sets up the plugin folder structure
    paths: {
      // Path to plugin source files - this is where the main plugin entry file is located. Set this to a dot (.) if the
      // main plugin file and sake.config.js are in teh same directory. The path is relative to the current working directory.
      // Mostly, this is the only path a plugin/repo needs to explicitly set
      src: '.',
      // where plugin assets are located, relative to `src`
      assets: 'assets',
      // where plugin CSS/SCSS assets are located, relative to `src`
      css: 'assets/css',
      // where plugin JS/COFFEE assets are located, relative to `src`
      js: 'assets/js',
      // where plugin image assets are located, relative to `src`
      images: 'assets/img',
      // where plugin font assets are located, relative to `src`
      fonts: 'assets/fonts',
      // the directory where plugin files are copied during the build task, relative to current working directory
      build: 'build',
      // path to the directory where production (WC and WP.org SVN) repos are cloned, may be an absolute path or relative to current working directory
      tmp: '/tmp/sake',
      // array of paths that should be excluded from the build
      exclude: []
    },

    // Task-specific settings, set the key to task name and provide any settings as needed. Since sake uses Gulp behind the scenes
    // and Gulp prefers code over configuration, there isn't a lot to do here. As you can see, some of these values can be defined
    // as environment variables, as this makes more sense - ie whether you want to use browsersync or not is specific tp your local
    // dev environment and workflow, not to a particular repo.
    tasks: {
      makepot: {
        reportBugsTo: 'https://woocommerce.com/my-account/marketplace-ticket-form/',
        domainPath: 'i18n/languages'
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
    // which deploy type does this plugin use - either 'wc' or 'wp', defaults to 'wc', specify `null` or `false` for no automated deploy
    deploy: 'wc',
    // the e-commerce platform this plugin is for, 'wc' or 'edd'
    platform: 'wc'
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

  return _.merge(defaults, localConfig)
}

const sakeConfig = buildSakeConfig();

export default sakeConfig;
