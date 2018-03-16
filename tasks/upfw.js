module.exports = (gulp, config, plugins, options, pipes) => {
  // reload the framework version after updating the framework
  gulp.task('set_framework_version', (done) => {
    config.plugin.frameworkVersion = require('../lib/utilities')(config, options).getFrameworkVersion()
    done()
  })

  // update framework to a specific version or branch
  // example use: `sake upfw` or `sake upfw --backwards_compatible=4.4 --minimum_wc_version=2.5.5 --tested_up_to_wc_version=2.7.0 --minimum_wp_version=4.1 --tested_up_to_wp_version=4.6`
  gulp.task('upfw', gulp.series([
    'shell:update_framework',
    'set_framework_version',
    'bump:minreqs',
    'shell:update_framework_commit'
  ]))
}
