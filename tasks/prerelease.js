const fs = require('fs')

module.exports = (gulp, plugins, sake) => {
  // validate env variables before deploying a prerelease
  function validateEnvVariables () {
    let errors = []

    if (!process.env.DROPBOX_PATH) {
      errors.push('DROPBOX_PATH not set')
    }

    let dropboxPath = sake.resolvePath(process.env.DROPBOX_PATH)

    if (!fs.existsSync(dropboxPath)) {
      errors.push(`DROPBOX_PATH is invalid - the path '${dropboxPath}' does not exist`)
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
