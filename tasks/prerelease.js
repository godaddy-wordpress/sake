const fs = require('fs')

module.exports = (gulp, config, plugins, options) => {
  const util = require('../lib/utilities')(config, options)

  // validate env variables before deploying a prerelease
  function validateEnvVariables () {
    let errors = []

    if (!process.env.DROPBOX_PATH) {
      errors.push('DROPBOX_PATH not set')
    }

    let dropboxPath = util.resolvePath(process.env.DROPBOX_PATH)

    if (!fs.existsSync(dropboxPath)) {
      errors.push(`DROPBOX_PATH is invalid - the path '${dropboxPath}' does not exist`)
    }

    if (errors.length) {
      let err = new Error('Environment variables missing or invalid: \n * ' + errors.join('\n * '))
      err.showStack = false
      throw err
    }
  }

  // bumps the version in the main plugin file to match changelog.txt
  gulp.task('prerelease', (done) => {
    validateEnvVariables()

    if (!util.isDeployable()) {
      let err = new Error('Plugin is not deployable: \n * ' + util.getChangelogErrors().join('\n * '))
      err.showStack = false
      throw err
    }

    gulp.series('bump', 'zip', 'clean:prerelease', 'copy:prerelease', 'clean:build')(done)
  })
}
