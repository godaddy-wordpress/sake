import gulp from 'gulp'
import { lintCoffee, lintJs, lintScripts } from './lint.js'
import { compileBlocks, compileCoffee, compileJs, compileScripts } from './compile.js'
import sake from '../lib/sake.js'

/**
 * The main task
 */
const scripts = (done) => {
  let tasks = [lintScripts, compileScripts]

  // don't lint styles if they have already been linted, unless we're watching
  if (! sake.isWatching && gulp.lastRun(lintScripts)) {
    tasks.shift()
  }

  gulp.series(tasks)(done)
}

/** type-specific script tasks - lints and then compiles */

const scriptsCoffee = gulp.series(lintCoffee, compileCoffee)
scriptsCoffee.displayName = 'scripts:coffee'

const scriptsJs = gulp.series(lintJs, compileJs)
scriptsJs.displayName = 'scripts:js'

const scriptsBlocks = gulp.series(compileBlocks)
scriptsBlocks.displayName = 'compile:blocks'

export {
  scripts,
  scriptsCoffee,
  scriptsJs,
  scriptsBlocks
}
