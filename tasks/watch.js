const log = require('fancy-log')

// watch files for changes and compile assets necessary
module.exports = (gulp, config, plugins) => {
  gulp.task('watch', () => {
    // start browsersync if enabled
    if (config.tasks.watch.useBrowserSync) {
      let port = null

      const getPort = () => {
        return port
      }

      plugins.browserSync.init({
        proxy: {
          target: config.tasks.browserSync.url,
          proxyReq: [(proxyReq) => {
            proxyReq.setHeader('X-Forwarded-Host', 'localhost:' + getPort())
          }]
        }
      }, (err, bs) => {
        if (err) {
          log.error(err)
        }
        port = bs.options.get('port')
      })
    }

    // allow other tasks to check if the watch task is running
    config.isWatching = true

    // kick off the watchers
    gulp.watch(`${config.paths.assetPaths.js}/**/*.coffee`, gulp.parallel('scripts:coffee'))
    gulp.watch(`${config.paths.assetPaths.css}/**/*.scss`, gulp.parallel('styles'))
    gulp.watch(config.paths.assetPaths.javascriptSources, gulp.parallel('scripts:js'))
    // watching images will result in an endless loop, because imagemin changes the original files - a possible
    // workaround would be to place all original images in a separate directory
    // gulp.watch(`${config.paths.assetPaths.images}/**.*{png,jpg,gif,svg}`, gulp.parallel('imagemin'))
    // TODO: should we also watch for changes in PHP files and regenerate POT files and reload the browser?
  })
}
