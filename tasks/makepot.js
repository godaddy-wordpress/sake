import log from 'fancy-log'
import shell from 'shelljs'

// generate POT files using wp cli
module.exports = (gulp, plugins, sake) => {
  gulp.task('makepot', (done) => {
    const options = sake.config.tasks.makepot
    const domainPath = ( options.domainPath || 'i18n/languages' ) + '/' + sake.config.plugin.id + '.pot'
    const excludedPaths = ['.github/.*', 'lib/.*', 'vendor/.*', 'tests/.*', 'node_modules/.*']
    const excluded = excludedPaths.map((path) => `--exclude="${path}"`).join(' ')
    const headers = options.reportBugsTo ? `--headers='{"Report-Msgid-Bugs-To": "${options.reportBugsTo}"}'` : ''

    log.info('Generating POT file...')

    let result = shell.exec(`wp i18n make-pot . ${domainPath}  ${headers} ${excluded}`)

    if (result.code !== 0) {
      sake.throwError(`Error while generating POT file: ${result.stderr ?? 'unknown error.'}`)
      done(result.stderr)
    } else {
      log.info(result.stdout)
      log.error(result.stderr)
      done()
    }
  })
}
