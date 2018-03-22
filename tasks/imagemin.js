module.exports = (gulp, plugins, sake) => {
  // optimize images
  gulp.task('imagemin', () => {
    return gulp.src(`${sake.config.paths.assetPaths.images}/**.*{png,jpg,gif,svg}`)
      .pipe(plugins.imagemin())
      .pipe(gulp.dest(sake.config.paths.assetPaths.images))
      .pipe(plugins.if(() => sake.isWatching && sake.config.tasks.watch.useBrowserSync, plugins.browserSync.stream()))
  })
}
