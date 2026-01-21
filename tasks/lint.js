import path from 'node:path'
import dottie from 'dottie'
import fs from 'node:fs'
import * as gulp from 'gulp'
import sake from '../lib/sake.js'
import phplint from 'gulp-phplint'
import coffeelint from 'gulp-coffeelint'
import eslint from 'gulp-eslint'
import postcss from 'gulp-postcss'
import stylelint from 'stylelint'
import scssSyntax from 'postcss-scss'
import { fileURLToPath } from 'node:url'
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const lintPhpTask = (done) => {
  if (process.argv.includes('--skip-linting')) {
    return Promise.resolve()
  }

  let paths = [
    `${sake.config.paths.src}/**/*.php`,
    `!${sake.config.paths.vendor}/**/*.php`,
    `!**/node_modules/**/*.php`
  ]

  // skip composer paths
  if (sake.config.composer) {
    let installerPaths = dottie.get(sake.config.composer, 'extra.installer-paths')

    if (installerPaths) {
      Object.keys(installerPaths).forEach((vendorPath) => {
        paths.push(`!${vendorPath}/**/*.php`)
      })
    }
  }

  return gulp.src(paths)
    .pipe(phplint('', { skipPassedFiles: true, notify: false }))
    .pipe(phplint.reporter((file) => {
      let report = file.phplintReport || {}
      // make sure to fail on first error
      if (report.error) {
        sake.throwError(`${report.message} on line ${report.line} of ${report.filename}`)
      }
    }))
}
lintPhpTask.displayName = 'lint:php'

const lintCoffeeTask = (done) => {
  if (process.argv.includes('--skip-linting')) {
    return Promise.resolve()
  }

  if (! fs.existsSync(sake.config.paths.assetPaths.js)) {
    return Promise.resolve()
  }

  let coffeeLintFile = sake.options['coffeelint-file'] ? path.join(process.cwd(), sake.options['coffeelint-file']) : path.join(__dirname, '../lib/lintfiles/coffeelint.json')

  return gulp.src(`${sake.config.paths.assetPaths.js}/**/*.coffee`)
    .pipe(coffeelint(coffeeLintFile))
    .pipe(coffeelint.reporter())
    .pipe(coffeelint.reporter('fail')) // fail task on errors
    .on('end', done)
    .on('error', done)
}
lintCoffeeTask.displayName = 'lint:coffee'

const lintJsTask = (done) => {
  if (process.argv.includes('--skip-linting')) {
    return Promise.resolve()
  }

  if (! fs.existsSync(sake.config.paths.assetPaths.js)) {
    return Promise.resolve()
  }

  // use WordPress standards - overrideable by individual plugins that provide a .eslintrc file
  // see https://github.com/WordPress-Coding-Standards/eslint-config-wordpress/blob/master/index.js
  let esLintFile = sake.options['eslint-configFile'] ? path.join(process.cwd(), sake.options['eslint-configFile']) : path.join(__dirname, '../lib/lintfiles/.eslintrc')
  let esLintOptions = {
    configFile: esLintFile,
    quiet: false
  }

  return gulp.src(sake.config.paths.assetPaths.javascriptSources)
    .pipe(eslint(esLintOptions))
    .pipe(eslint.format('table'))
}
lintJsTask.displayName = 'lint:js'

const lintScssTask = (done) => {
  if (process.argv.includes('--skip-linting')) {
    return Promise.resolve()
  }

  if (! fs.existsSync(sake.config.paths.assetPaths.css)) {
    return Promise.resolve()
  }

  let stylelintConfigFile = sake.options['stylelint-configFile'] ? path.join(process.cwd(), sake.options['stylelint-configFile']) : path.join(__dirname, '../lib/lintfiles/.stylelintrc.json')

  return gulp.src(`${sake.config.paths.assetPaths.css}/**/*.scss`)
    .pipe(postcss([
      stylelint({
        configFile: stylelintConfigFile,
        failAfterError: true
      })
    ], { syntax: scssSyntax }))
    // explicitly setting end and error event handlers will give us cleaner error logging
    .on('end', done)
    .on('error', done)
}
lintScssTask.displayName = 'lint:scss'

// the main task to lint scripts
const lintScriptsTask = gulp.parallel(lintCoffeeTask, lintJsTask)
lintScriptsTask.displayName = 'lint:scripts'

// the main task to lint styles
const lintStylesTask = gulp.parallel(lintScssTask)
lintStylesTask.displayName = 'lint:styles'

const lintTask = gulp.parallel(lintPhpTask, lintScriptsTask, lintStylesTask)
lintTask.displayName = 'lint'

export {
  lintTask,
  lintScriptsTask,
  lintPhpTask,
  lintCoffeeTask,
  lintJsTask,
  lintScssTask,
  lintStylesTask
}
