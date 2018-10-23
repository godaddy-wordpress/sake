const wpi18n = require('node-wp-i18n')

// generate POT files
module.exports = (gulp, plugins, sake) => {
  gulp.task('makepot', () => {
    let options = {
      cwd: `${process.cwd()}/${sake.config.paths.src}`,
      domainPath: sake.config.tasks.makepot.domainPath,
      exclude: [ 'lib/*', 'vendor/.*', 'tests/.*', 'node_modules/.*' ],
      potHeaders: { 'report-msgid-bugs-to': sake.config.tasks.makepot.reportBugsTo },
      processPot: function (pot) {
        delete pot.headers['x-generator']
        return pot
      }, // jshint ignore:line
      type: 'wp-plugin',
      updateTimestamp: false
    }

    return wpi18n.makepot(options)
  })
}
