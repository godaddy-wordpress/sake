module.exports = (gulp, plugins, sake) => {
  // main task for (optionally) linting and compiling scripts
  gulp.task('scripts', (done) => {
    let tasks = ['lint:scripts', 'compile:scripts']

    // don't lint styles if they have already been linted, unless we're watching
    if (!sake.isWatching && gulp.lastRun('lint:scripts')) {
      tasks.shift()
    }

    gulp.series(tasks)(done)
  })

  // type-specific script tasks - lints and then compiles
  gulp.task('scripts:coffee', gulp.series('lint:coffee', 'compile:coffee'))
  gulp.task('scripts:js', gulp.series('lint:js', 'compile:js'))
  gulp.task('scripts:blocks', gulp.series('compile:blocks'))
}
