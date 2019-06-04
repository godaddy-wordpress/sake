module.exports = (gulp, plugins, sake) => {

  // converts CoffeeScripts to ES6 JavaScript without minification or further handling
  gulp.task('decaffeinate', () => {
    return gulp.src(`${sake.config.paths.assetPaths.js}/**/*.coffee`)
      .pipe(plugins.coffee({ bare: false }))
      .pipe(gulp.dest(sake.config.paths.assetPaths.js))
      .pipe(plugins.if(() => sake.isWatching && sake.config.tasks.watch.useBrowserSync, plugins.browserSync.stream.apply({ match: '**/*.js' })))
  })
}
