import _ from 'lodash';
import gulp from 'gulp'
import sake from '../lib/sake.js'
import { cleanBuildTask, cleanComposerTask } from './clean.js'
import { shellComposerInstallTask, shellComposerStatusTask } from './shell.js'
import { compile } from './compile.js'
import { copyBuildTask } from './copy.js'
import { bundleTask } from './bundle.js'

/**
 * The main task for building the plugin:
 *  - Cleans the build directory
 *  - Compiles the plugin assets (linting where necessary)
 *  - Bundles any external dependencies to the plugin assets
 *  - Copies plugin files to the build directory
 */
const buildTask = (done) => {
  let tasks = [cleanBuildTask, shellComposerStatusTask, cleanComposerTask, shellComposerInstallTask, compile, bundleTask, copyBuildTask]

  if (sake.options['skip-composer']) {
    tasks = _.without(tasks, shellComposerStatusTask, cleanComposerTask, shellComposerInstallTask)
  }

  return gulp.series(tasks)
}
buildTask.displayName = 'build'

export {
  buildTask
}
