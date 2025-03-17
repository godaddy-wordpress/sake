import gulp from 'gulp'
import { lintCoffeeTask, lintJsTask, lintScriptsTask } from './lint.js'
import { compileBlocksTask, compileCoffeeTask, compileJsTask, compileScripts } from './compile.js'
import sake from '../lib/sake.js'

/**
 * The main task
 */
const scripts = (done) => {
  let tasks = [lintScriptsTask, compileScripts]

  // don't lint styles if they have already been linted, unless we're watching
  if (! sake.isWatching && gulp.lastRun(lintScriptsTask)) {
    tasks.shift()
  }

  gulp.series(tasks)(done)
}
scripts.displayName = 'scripts'

/** type-specific script tasks - lints and then compiles */

const scriptsCoffee = gulp.series(lintCoffeeTask, compileCoffeeTask)
scriptsCoffee.displayName = 'scripts:coffee'

const scriptsJs = gulp.series(lintJsTask, compileJsTask)
scriptsJs.displayName = 'scripts:js'

const scriptsBlocks = gulp.series(compileBlocksTask)
scriptsBlocks.displayName = 'compile:blocks'

export {
  scripts,
  scriptsCoffee,
  scriptsJs,
  scriptsBlocks
}
