import fs from 'node:fs'
import path from 'node:path'
import dottie from 'dottie'
import sake from '../lib/sake.js'
import gulp from 'gulp'
import { bumpFrameworkVersionTask, bumpMinReqsTask } from './bump.js'
import { shellComposerUpdateTask, shellUpdateFrameworkCommitTask, shellUpdateFrameworkTask } from './shell.js'

/**
 * Reload the framework version after updating the framework
 */
const setFrameworkVersionTask = (done) => {
  sake.config.plugin.frameworkVersion = sake.getFrameworkVersion()
  done()
}
setFrameworkVersionTask.displayName = 'set_framework_version'

/**
 * Update the framework to a specific version or branch
 * example use: `sake upfw` or `sake upfw --backwards_compatible=4.4 --minimum_wc_version=2.5.5 --tested_up_to_wc_version=2.7.0 --minimum_wp_version=4.1 --tested_up_to_wp_version=4.6`
 */
const updateFrameworkTask = (done) => {
  let tasks = [
    setFrameworkVersionTask,
    bumpMinReqsTask,
    shellUpdateFrameworkCommitTask
  ]

  if (sake.config.framework === 'v4' && !dottie.get(sake.config.composer, 'require.skyverge/wc-plugin-framework')) {
    tasks.unshift(shellUpdateFrameworkTask)
  }

  if (sake.config.framework === 'v5') {
    tasks.unshift(bumpFrameworkVersionTask)
  }

  // update composer
  if (!sake.options['skip-composer-update']) {
    // ensure FW version to update to is specified
    if (!sake.options.framework_version) {
      sake.throwError('Framework version not specified')
    }

    dottie.set(sake.config.composer, 'require.skyverge/wc-plugin-framework', sake.options.framework_version)

    // update composer.json
    fs.writeFileSync(path.join(process.cwd(), 'composer.json'), JSON.stringify(sake.config.composer, null, '  '))

    tasks.unshift(shellComposerUpdateTask)
  } else {
    sake.options.framework_version = sake.config.plugin.frameworkVersion
  }

  gulp.series(tasks)(done)
}
updateFrameworkTask.displayName = 'upfw'

export {
  setFrameworkVersionTask,
  updateFrameworkTask
}
