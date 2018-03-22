const path = require('path')

module.exports = (gulp, config, plugins, options) => {

  gulp.task('lint', gulp.parallel('lint:php', 'lint:scripts', 'lint:styles'))

  gulp.task('lint:php', (done) => {
    return gulp.src(`${config.paths.src}/**/*.php`)
      .pipe(plugins.phplint('', { skipPassedFiles: true, notify: false }))
      .pipe(plugins.phplint.reporter((file) => {
        let report = file.phplintReport || {}
        // make sure to fail on first error
        if (report.error) {
          let err = new Error(`${report.message} on line ${report.line} of ${report.filename}`)
          err.showStack = false
          throw err
        }
      }))
  })

  // the main task to lint scripts
  gulp.task('lint:scripts', gulp.parallel('lint:coffee', 'lint:js'))

  // lint coffee
  gulp.task('lint:coffee', (done) => {
    let coffeeLintFile = options['coffeelint-file'] ? path.join(process.cwd(), options['coffeelint-file']) : path.join(__dirname, '../lib/lintfiles/coffeelint.json')

    return gulp.src(`${config.paths.assetPaths.js}/**/*.coffee`)
      .pipe(plugins.coffeelint(coffeeLintFile))
      .pipe(plugins.coffeelint.reporter())
      .pipe(plugins.coffeelint.reporter('fail')) // fail task on errors
      .on('end', done)
      .on('error', done)
  })

  // lint plain JS
  gulp.task('lint:js', () => {
    let esLintFile = options['eslint-configFile'] ? path.join(process.cwd(), options['eslint-configFile']) : path.join(__dirname, '../lib/lintfiles/.eslintrc')

    return gulp.src(config.paths.assetPaths.javascriptSources)
      .pipe(plugins.eslint({ configFile: esLintFile }))
      .pipe(plugins.eslint.failOnError()) // fail task on errors
  })

  // main task for linting styles
  gulp.task('lint:styles', gulp.parallel('lint:scss'))

  // lint SCSS
  gulp.task('lint:scss', (done) => {
    return gulp.src(`${config.paths.assetPaths.css}/**/*.scss`)
      .pipe(plugins.sassLint())
      .pipe(plugins.sassLint.failOnError()) // fail task on errors
      // explicitly setting end and error event handlers will give us cleaner error logging
      .on('end', done)
      .on('error', done)
  })
}
