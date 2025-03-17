import sake from '../lib/sake.js'
import gulp from 'gulp'
import zip from 'gulp-zip'
import { buildTask } from './build.js'

const zipTask = (done) => {
  let zipDest = sake.options.zipDest || sake.config.paths.build
  let zipFileName = sake.config.plugin.id + '.' + sake.getPluginVersion() + '.zip'

  sake.config.paths.zipDest = sake.resolvePath(zipDest)

  return gulp.src([
    `${sake.config.paths.build}/${sake.config.plugin.id}/**`,
    `!${sake.config.paths.build}/${sake.config.plugin.id}/**/*.zip`
  ], { nodir: true, base: sake.config.paths.build }) // exclude empty directories, include plugin dir in zip
    .pipe(zip(zipFileName))
    .pipe(gulp.dest(sake.config.paths.zipDest))
}
zipTask.displayName = 'compress'

const buildAndZip = gulp.series(buildTask, zipTask)
buildAndZip.displayName = 'zip'

export {
  zipTask,
  buildAndZip
}
