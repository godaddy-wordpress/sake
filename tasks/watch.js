import log from 'fancy-log'
import browserSync from 'browser-sync'
import sake from '../lib/sake.js'
import gulp from 'gulp'

const watchTask = (done) => {
  // start browsersync if enabled
  if (sake.config.tasks.watch.useBrowserSync) {
    let port = null

    const getPort = () => {
      return port
    }

    browserSync.init({
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
      port = bs.options.get('port')
    })
  }

  // allow other tasks to check if the watch task is running
  sake.isWatching = true

  // kick off the watchers
  // TODO: consider breaking the pipes apart, so that we can only lint and compile the
  // files that were actually changed (ie not all coffee files when only a single one was changed) {IT 2018-03-21}
  gulp.watch(sake.config.paths.assetPaths.javascriptSources, gulp.parallel('scripts:js'))
  gulp.watch(`${sake.config.paths.assetPaths.js}/**/*.coffee`, gulp.parallel('scripts:coffee'))
  gulp.watch(`${sake.config.paths.assetPaths.css}/**/*.scss`, gulp.parallel('styles'))
  // watching images will result in an endless loop, because imagemin changes the original files - a possible
  // workaround would be to place all original images in a separate directory
  // gulp.watch(`${sake.config.paths.assetPaths.images}/**.*{png,jpg,gif,svg}`, gulp.parallel('imagemin'))
  // TODO: should we also watch for changes in PHP files and regenerate POT files and reload the browser?
}
watchTask.displayName = 'watch'

export {
  watchTask
}
