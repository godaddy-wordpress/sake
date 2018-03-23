const fs = require('fs')
const path = require('path')
const dottie = require('dottie')

module.exports = (gulp, plugins, sake) => {
  // reload the framework version after updating the framework
  gulp.task('set_framework_version', (done) => {
    sake.config.plugin.frameworkVersion = sake.getFrameworkVersion()
    done()
  })

  // update framework to a specific version or branch
  // example use: `sake upfw` or `sake upfw --backwards_compatible=4.4 --minimum_wc_version=2.5.5 --tested_up_to_wc_version=2.7.0 --minimum_wp_version=4.1 --tested_up_to_wp_version=4.6`
  gulp.task('upfw', (done) => {
    let tasks = [
      'set_framework_version',
      'bump:minreqs',
      'shell:update_framework_commit'
    ]

    if (sake.config.framework === 'v4' && !dottie.get(sake.config.composer, 'require.skyverge/wc-plugin-framework')) {
      tasks.unshift('shell:update_framework')
    }

    if (sake.config.framework === 'v5') {
      tasks.unshift('bump:framework_version')
    }

    // update composer
    if (!sake.options['skip-composer-update']) {
      // ensure FW version to update to is specified
      if (!sake.options.framework_version) {
        sake.throwError('Framework version not specified')
      }

      dottie.set(sake.config.composer, 'require.skyverge/wc-plugin-framework', sake.options.framework_version)

      // update composer.json
      fs.writeFileSync(path.join(process.cwd(), 'composer.json'), JSON.stringify(sake.config.composer, null, '  '))

      tasks.unshift('shell:composer_update')
    } else {
      sake.options.framework_version = sake.config.plugin.frameworkVersion
    }

    gulp.series(tasks)(done)
  })
}
