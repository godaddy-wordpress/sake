import gulp from 'gulp'
import path from 'node:path'
import fs from 'node:fs'
import log from 'fancy-log'
import ForwardReference from 'undertaker-forward-reference'
import dotenv from 'dotenv'
import gulpPlugins from 'gulp-load-plugins'
import notifier from 'node-notifier'
import stripAnsi from 'strip-ansi'
import browserSync from 'browser-sync'
import { fileURLToPath } from 'node:url'
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// local .env file, overriding any global env variables
let parentEnvPath = path.join('..', '.env')
let envPath = fs.existsSync('.env') ? '.env' : (fs.existsSync(parentEnvPath) ? parentEnvPath : null)

if (envPath) {
  let result = dotenv.config({ path: envPath })

  log.warn(`Loading ENV variables from ${path.join(process.cwd(), envPath)}`)

  for (let k in result.parsed) {
    process.env[k] = result.parsed[k]
  }
}

// development .env file, overriding any global env variables, or repo/plugin specific variables
let devEnv = path.join(__dirname, '.env')
if (fs.existsSync(devEnv)) {
  let result = dotenv.config({path: devEnv})

  log.warn('LOADING DEVELOPMENT ENV VARIABLES FROM ' + devEnv)

  for (let k in result.parsed) {
    process.env[k] = result.parsed[k]
  }
}

// enable forward-referencing tasks, see https://github.com/gulpjs/gulp/issues/1028
gulp.registry(ForwardReference())

// @link https://github.com/jackfranklin/gulp-load-plugins/issues/141#issuecomment-2373391177
let plugins = gulpPlugins({
  config: path.resolve(__dirname, 'package.json')
})

// Attach browsersync as a plugin - not really a plugin, but it helps to
// pass around the browsersync instance between tasks. Unfortunately, we
// always have to load and create an instance of it, because gulp-if does not
// support lazy evaluation yet: https://github.com/robrich/gulp-if/issues/75
plugins.browserSync = browserSync.create()

// show notification on task errors
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

/************** Task Exports */

export * from './tasks/bump.js'
export * from './tasks/validate.js'
export * from './tasks/wc.js'
