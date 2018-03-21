const log = require('fancy-log')

module.exports = (gulp, config) => {
  // prints current configuration
  gulp.task('config', (done) => {
    console.log(config)
    done()
  })
}
