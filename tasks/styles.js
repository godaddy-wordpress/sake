module.exports = (gulp, config, plugins, options) => {
  // main task for (optionally) linting and compiling styles
  gulp.task('styles', (done) => {
    let tasks = ['lint:styles', 'compile:styles']

    // don't lint styles if they have already been linted, unless we're watching
    if (!config.isWatching && gulp.lastRun('lint:styles')) {
      tasks.shift()
    }

    gulp.series(tasks)(done)
  })
}
