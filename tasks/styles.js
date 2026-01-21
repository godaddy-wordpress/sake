import gulp from 'gulp'
import sake from '../lib/sake.js'
import { lintStylesTask } from './lint.js'
import { compileStyles } from './compile.js'
import { skipLinting } from '../helpers/arguments.js'

const stylesTask = (done) => {
  let tasks = [lintStylesTask, compileStyles]

  // don't lint styles if they have already been linted, unless we're watching
  if ((!sake.isWatching && gulp.lastRun(lintStylesTask)) || skipLinting()) {
    tasks.shift()
  }

  gulp.series(tasks)(done)
}
stylesTask.displayName = 'styles'

export {
  stylesTask
}
