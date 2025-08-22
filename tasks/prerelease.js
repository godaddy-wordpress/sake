import fs from 'node:fs'
import sake from '../lib/sake.js'
import gulp from 'gulp'
import { bumpTask } from './bump.js'
import { zipTask } from './zip.js'
import { cleanBuildTask, cleanPrereleaseTask } from './clean.js'
import { copyPrereleaseTask } from './copy.js'

// validate env variables before deploying a prerelease
function validateEnvVariables () {
  let errors = []
  let prereleasePath = ''

  if (process.env.SAKE_PRE_RELEASE_PATH) {
    prereleasePath = sake.resolvePath(process.env.SAKE_PRE_RELEASE_PATH)
  } else {
    errors.push('SAKE_PRE_RELEASE_PATH not set')
  }

  if (prereleasePath && !fs.existsSync(prereleasePath)) {
    errors.push(`SAKE_PRE_RELEASE_PATH is invalid - the path '${prereleasePath}' does not exist`)
  }

  if (errors.length) {
    sake.throwError('Environment variables missing or invalid: \n * ' + errors.join('\n * '))
  }
}

/**
 * Bumps the version in the main plugin file to match changelog.txt
 */
const prereleaseTask = (done) => {
  validateEnvVariables()

  if (!sake.isDeployable()) {
    sake.throwError('Plugin is not deployable: \n * ' + sake.getChangelogErrors().join('\n * '))
  }

  gulp.series(bumpTask, zipTask, cleanPrereleaseTask, copyPrereleaseTask, cleanBuildTask)(done)
}
prereleaseTask.displayName = 'prerelease'

const preTask = gulp.parallel(prereleaseTask)
preTask.displayName = 'pre'

export {
  prereleaseTask,
  preTask
}
