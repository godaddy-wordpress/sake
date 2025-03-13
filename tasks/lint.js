import path from 'node:path'
import dottie from 'dottie'
import fs from 'node:fs'
import * as gulp from 'gulp'
import sake from '../lib/sake.js'
import phplint from 'gulp-phplint'
import coffeelint from 'gulp-coffeelint'
import eslint from 'gulp-eslint'
import sassLint from 'gulp-sass-lint'
import { fileURLToPath } from 'node:url'
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const lintPhp = (done) => {
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
lintPhp.displayName = 'lint:php'

const lintCoffee = (done) => {
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
lintCoffee.displayName = 'lint:coffee'

const lintJs = (done) => {
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
lintJs.displayName = 'lint:js'

const lintScss = (done) => {
  if (! fs.existsSync(sake.config.paths.assetPaths.css)) {
    return Promise.resolve()
  }

  return gulp.src(`${sake.config.paths.assetPaths.css}/**/*.scss`)
    .pipe(sassLint())
    .pipe(sassLint.failOnError()) // fail task on errors
    // explicitly setting end and error event handlers will give us cleaner error logging
    .on('end', done)
    .on('error', done)
}
lintScss.displayName = 'lint:scss'

// the main task to lint scripts
const lintScripts = gulp.parallel(lintCoffee, lintJs)
lintScripts.displayName = 'lint:scripts'

// the main task to lint styles
const lintStyles = gulp.parallel(lintScss)
lintStyles.displayName = 'lint:styles'

const lint = gulp.parallel(lintPhp, lintScripts, lintStyles)

export {
  lint,
  lintScripts,
  lintPhp,
  lintCoffee,
  lintJs,
  lintScss,
  lintStyles
}
