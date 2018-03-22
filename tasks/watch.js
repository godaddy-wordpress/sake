const log = require('fancy-log')

// watch files for changes and compile assets necessary
module.exports = (gulp, plugins, sake) => {
  gulp.task('watch', () => {
    // start browsersync if enabled
    if (sake.config.tasks.watch.useBrowserSync) {
      let port = null

      const getPort = () => {
        return port
      }

      plugins.browserSync.init({
        proxy: {
          target: sake.config.tasks.browserSync.url,
          proxyReq: [(proxyReq) => {
            proxyReq.setHeader('X-Forwarded-Host', 'localhost:' + getPort())
          }]
        }
      }, (err, bs) => {
        if (err) {
          log.error(err)
        }
        port = bs.sake.options.get('port')
      })
    }

    // allow other tasks to check if the watch task is running
    sake.isWatching = true

    // kick off the watchers
    // TODO: consider breaking the pipes apart, so that we can only lint and compile the
    // files that were actually changed (ie not all coffee files when only a single one was changed)
    gulp.watch(sake.config.paths.assetPaths.javascriptSources, gulp.parallel('scripts:js'))
    gulp.watch(`${sake.config.paths.assetPaths.js}/**/*.coffee`, gulp.parallel('scripts:coffee'))
    gulp.watch(`${sake.config.paths.assetPaths.css}/**/*.scss`, gulp.parallel('styles'))
    // watching images will result in an endless loop, because imagemin changes the original files - a possible
    // workaround would be to place all original images in a separate directory
    // gulp.watch(`${sake.config.paths.assetPaths.images}/**.*{png,jpg,gif,svg}`, gulp.parallel('imagemin'))
    // TODO: should we also watch for changes in PHP files and regenerate POT files and reload the browser?
  })
}
