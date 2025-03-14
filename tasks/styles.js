import gulp from 'gulp'
import sake from '../lib/sake.js'
import { lintStyles } from './lint.js'
import { compileStyles } from './compile.js'

const styles = (done) => {
  let tasks = [lintStyles, compileStyles]

  // don't lint styles if they have already been linted, unless we're watching
  if (!sake.isWatching && gulp.lastRun(lintStyles)) {
    tasks.shift()
  }

  gulp.series(tasks)(done)
}

export {
  styles
}
