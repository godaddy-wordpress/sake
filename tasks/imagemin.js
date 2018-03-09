'use strict'

// compile sass styles
module.exports = (gulp, config, plugins) => {
  gulp.task('imagemin', () => {
    return gulp.src(`${config.paths.assetPaths.images}/**.*{png,jpg,gif,svg}`)
      .pipe(plugins.imagemin())
      .pipe(gulp.dest(config.paths.assetPaths.images))
      .pipe(plugins.if(() => config.isWatching && config.tasks.watch.useBrowserSync, plugins.browserSync.stream()))
  })
}
