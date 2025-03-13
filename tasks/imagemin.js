import fs from 'node:fs';
import log from 'fancy-log';
import imagemin from 'gulp-imagemin'
import * as gulp from 'gulp'
import * as gulpif from 'gulp-if'
import sake from '../lib/sake.js'
import browserSync from 'browser-sync'

const minifyImages = (done) => {
  if (! fs.existsSync(sake.config.paths.assetPaths.images)) {
    log.info(`The directory ${sake.config.paths.assetPaths.images} does not exist.`)
    return Promise.resolve()
  }

  return gulp.src(`${sake.config.paths.assetPaths.images}/**.*{png,jpg,gif,svg}`)
    .pipe(imagemin())
    .pipe(gulp.dest(sake.config.paths.assetPaths.images))
    .pipe(gulpif(() => sake.isWatching && sake.config.tasks.watch.useBrowserSync, browserSync.stream()))
}

minifyImages.displayName = 'imagemin'

export {
  minifyImages
}
