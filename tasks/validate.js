const fs = require('fs')
const log = require('fancy-log')

module.exports = (gulp, plugins, sake) => {
  gulp.task('validate:readme_headers', (done) => {
    fs.readFile(`${sake.config.paths.src}/readme.txt`, 'utf8', (err, data) => {
      if (err) sake.throwError(err)

      let requiredHeaders = [
        'License',
        'License URI',
      ]

      if (sake.config.deploy.type === 'wp') {
        requiredHeaders.push('Stable tag')
      }

      requiredHeaders.forEach(headerName => {
        log.info(`Validating readme.txt header ${headerName}`)
        const regex = new RegExp(headerName + ':(.+)', 'ig')
        const headerValue = data.match(regex)

        if (! headerValue) {
          sake.throwError('Missing required header in readme.txt: ' + headerName)
        }
      })

      done()
    })
  })
}
