const dottie = require('dottie')

module.exports = (gulp, config, plugins, options) => {
  // prints current configuration
  gulp.task('config', (done) => {
    // pass --property=deploy.production to only see config values for that propery
    if (options.property) {
      console.log(dottie.get(config, options.property))
    } else {
      console.log(config)
    }

    done()
  })
}
