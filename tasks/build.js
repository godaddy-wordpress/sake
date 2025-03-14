import _ from 'lodash';
import gulp from 'gulp'
import sake from '../lib/sake.js'
import { cleanBuild, cleanComposer } from './clean.js'
import { shellComposerInstall, shellComposerStatus } from './shell.js'
import { compile } from './compile.js'
import { copyBuild } from './copy.js'

/**
 * The main task for building the plugin:
 *  - Cleans the build directory
 *  - Compiles the plugin assets (linting where necessary)
 *  - Bundles any external dependencies to the plugin assets
 *  - Copies plugin files to the build directory
 */
const build = (done) => {
  let tasks = [cleanBuild, shellComposerStatus, cleanComposer, shellComposerInstall, compile, 'bundle', copyBuild] // @TODO replace remaining

  if (sake.options['skip-composer']) {
    tasks = _.without(tasks, shellComposerStatus, cleanComposer, shellComposerInstall)
  }

  return gulp.series(tasks)
}

export {
  build
}
