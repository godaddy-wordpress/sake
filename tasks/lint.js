const path = require('path')
const dottie = require('dottie')

module.exports = (gulp, plugins, sake) => {
  gulp.task('lint', gulp.parallel('lint:php', 'lint:scripts', 'lint:styles'))

  gulp.task('lint:php', (done) => {

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
      .pipe(plugins.phplint('', { skipPassedFiles: true, notify: false }))
      .pipe(plugins.phplint.reporter((file) => {
        let report = file.phplintReport || {}
        // make sure to fail on first error
        if (report.error) {
          sake.throwError(`${report.message} on line ${report.line} of ${report.filename}`)
        }
      }))
  })

  // the main task to lint scripts
  gulp.task('lint:scripts', gulp.parallel('lint:coffee', 'lint:js'))

  // lint coffee
  gulp.task('lint:coffee', (done) => {
    let coffeeLintFile = sake.options['coffeelint-file'] ? path.join(process.cwd(), sake.options['coffeelint-file']) : path.join(__dirname, '../lib/lintfiles/coffeelint.json')

    return gulp.src(`${sake.config.paths.assetPaths.js}/**/*.coffee`)
      .pipe(plugins.coffeelint(coffeeLintFile))
      .pipe(plugins.coffeelint.reporter())
      .pipe(plugins.coffeelint.reporter('fail')) // fail task on errors
      .on('end', done)
      .on('error', done)
  })

  // lint plain JS
  gulp.task('lint:js', () => {
    // use WordPress standards - overrideable by individual plugins that provide a .eslintrc file
    // see https://github.com/WordPress-Coding-Standards/eslint-config-wordpress/blob/master/index.js
    let esLintFile = sake.options['eslint-configFile'] ? path.join(process.cwd(), sake.options['eslint-configFile']) : path.join(__dirname, '../lib/lintfiles/.eslintrc')
    let esLintOptions = {
      configFile: esLintFile,
      quiet: false
    }

    return gulp.src(sake.config.paths.assetPaths.javascriptSources)
      .pipe(plugins.eslint(esLintOptions))
      .pipe(plugins.eslint.format('codeframe'))
  })

  // main task for linting styles
  gulp.task('lint:styles', gulp.parallel('lint:scss'))

  // lint SCSS
  gulp.task('lint:scss', (done) => {
    return gulp.src(`${sake.config.paths.assetPaths.css}/**/*.scss`)
      .pipe(plugins.sassLint())
      .pipe(plugins.sassLint.failOnError()) // fail task on errors
      // explicitly setting end and error event handlers will give us cleaner error logging
      .on('end', done)
      .on('error', done)
  })
}
