const fs = require('fs')

module.exports = (gulp, plugins, sake) => {
  // validate env variables before deploying a prerelease
  function validateEnvVariables () {
    let errors = []

    if (!process.env.SAKE_PRE_RELEASE_PATH) {
      errors.push('SAKE_PRE_RELEASE_PATH not set')
    }

    let prereleasePath = sake.resolvePath(process.env.SAKE_PRE_RELEASE_PATH)

    if (!fs.existsSync(prereleasePath)) {
      errors.push(`SAKE_PRE_RELEASE_PATH is invalid - the path '${prereleasePath}' does not exist`)
    }

    if (errors.length) {
      sake.throwError('Environment variables missing or invalid: \n * ' + errors.join('\n * '))
    }
  }

  // bumps the version in the main plugin file to match changelog.txt
  gulp.task('prerelease', (done) => {
    validateEnvVariables()

    if (!sake.isDeployable()) {
      sake.throwError('Plugin is not deployable: \n * ' + sake.getChangelogErrors().join('\n * '))
    }

    gulp.series('bump', 'zip', 'clean:prerelease', 'copy:prerelease', 'clean:build')(done)
  })

  gulp.task( 'pre', gulp.parallel('prerelease'))
}
