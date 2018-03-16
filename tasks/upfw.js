const fs = require('fs')
const path = require('path')
const dottie = require('dottie')

module.exports = (gulp, config, plugins, options, pipes) => {
  // reload the framework version after updating the framework
  gulp.task('set_framework_version', (done) => {
    config.plugin.frameworkVersion = require('../lib/utilities')(config, options).getFrameworkVersion()
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

    if (config.framework === 'v4') {
      tasks.unshift('shell:update_framework')
    }

    if (config.framework === 'v5') {
      tasks.unshift('bump:framework_version')

      // update composer
      if (!options['skip-composer-update']) {
        // ensure FW version to update to is specified
        if (!options.framework_version) {
          let err = new Error('Framework version not specified')
          err.showStack = false
          throw err
        }

        dottie.set(config.composer, 'require.skyverge/wc-plugin-framework', options.framework_version)

        // update composer.json
        fs.writeFileSync(path.join(process.cwd(), 'composer.json'), JSON.stringify(config.composer, null, '  '))

        tasks.unshift('shell:composer_update')
      } else {
        options.framework_version = config.plugin.frameworkVersion
      }
    }

    gulp.series(tasks)(done)
  })
}
