const fs = require('fs')
const log = require('fancy-log')

module.exports = (gulp, config, plugins, options) => {
  const util = require('../lib/utilities')(config, options)

  // bumps the version in the main plugin file to match changelog.txt
  gulp.task('prerelease', (done) => {
    // check for required environment vaiables and that DROPBOX_PATH actually exists
    if (!process.env.DROPBOX_PATH && !fs.existsSync(util.resolvePath(process.env.DROPBOX_PATH))) {
      throw new Error('Prerelease failed :( Please check your environment vaiables')
    }

    if (!util.isDeployable()) {
      log.warn('Plugin cannot be deployed')
    }

    return gulp.series('bump', 'zip', 'clean:prerelease', 'copy:prerelease')(done)
  })
}
