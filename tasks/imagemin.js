const fs = require('fs')
const log = require('fancy-log')

module.exports = (gulp, plugins, sake) => {
  // optimize images
  gulp.task('imagemin', () => {
    if (! fs.existsSync(sake.config.paths.assetPaths.images)) {
      log.info(`The directory ${sake.config.paths.assetPaths.images} does not exist.`)
      return Promise.resolve()
    }

    return gulp.src(`${sake.config.paths.assetPaths.images}/**.*{png,jpg,gif,svg}`)
      .pipe(plugins.imagemin())
      .pipe(gulp.dest(sake.config.paths.assetPaths.images))
      .pipe(plugins.if(() => sake.isWatching && sake.config.tasks.watch.useBrowserSync, plugins.browserSync.stream()))
  })
}
