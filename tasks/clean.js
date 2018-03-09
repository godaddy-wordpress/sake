// const _ = require('lodash')

module.exports = (gulp, config, plugins, options) => {
  const util = require('../lib/utilities')(config, options)

  let defaultOptions = { read: false, allowEmpty: true }

  // clean dev dir from map files
  gulp.task('clean:dev', () => {
    return gulp.src(`${config.paths.src}/${config.paths.assets}/**/*.map`, defaultOptions).pipe(plugins.clean())
  })

  // clean (empty) build dir
  gulp.task('clean:build_dir', () => {
    return gulp.src(config.paths.build, defaultOptions).pipe(plugins.clean())
  })

  // clean build
  gulp.task('clean:build', () => {
    let paths = [
      // map files
      `${config.paths.build}/**/*.map`,

      // remove coffee and unminified js files
      `${config.paths.build}/${config.paths.js}/**/*.coffee`,
      `${config.paths.build}/${config.paths.js}/**/*.js`,
      `!${config.paths.build}/${config.paths.js}/**/*.min.js`,

      // remove scss and unminified css files
      `${config.paths.build}/${config.paths.js}/**/*.scss`,
      `${config.paths.build}/${config.paths.js}/**/*.css`,
      `!${config.paths.build}/${config.paths.js}/**/*.min.css`,

      // delete unit test files
      `${config.paths.build}/**/tests/**/*`,
      `${config.paths.build}/**/.travis.yml`,
      `${config.paths.build}/**/phpunit.xml`,
      `${config.paths.build}/**/phpunit.travis.xml`,

      // delete composer and npm files
      `${config.paths.build}/**/composer.json`,
      `${config.paths.build}/**/composer.lock`,
      `${config.paths.build}/**/package.json`,
      `${config.paths.build}/**/package-lock.json`,
      `${config.paths.build}/**/node_modules`,

      // Delete misc files
      `${config.paths.build}/**/modman`,
      `${config.paths.build}/**/.gitignore`,
      `${config.paths.build}/**/.DS_Store`,
      `${config.paths.build}/**/.zip`,

      // delete sake config
      `${config.paths.build}/sake.config.js`
    ]

    if (config.framework) {
      if (config.framework === 'v4') {
        paths = paths.concat([
          // remove common framework v4 files
          `${config.paths.build}/${config.paths.framework.base}/**/*`,
          `!${config.paths.build}/${config.paths.framework.base}/license.txt`,
          `!${config.paths.build}/${config.paths.framework.base}/woocommerce/**`,
          `${config.paths.build}/${config.paths.framework.base}/woocommerce/payment-gateway/templates/`
        ])
      }

      if (config.framework === 'v5') {
        // TODO: read vendor dir from composer.json
        paths = paths.concat([
          // remove common framework v5 files
          // - we have to do a little dance here to make sure the woocommerce folder isn't deleted
          `${config.paths.build}/*/vendor/composer/**`,
          `${config.paths.build}/*/vendor/autoload.php`,
          `${config.paths.build}/${config.paths.framework.base}/**/*`,
          `!${config.paths.build}/${config.paths.framework.base}/woocommerce/**`,
          `!${config.paths.build}/${config.paths.framework.base}/license.txt`,

          // delete v5 sample loader file
          `${config.paths.build}/${config.paths.framework.base}/woocommerce/woocommerce-framework-plugin-loader-sample.php`
        ])
      }

      paths = paths.concat([
        // remove framework coffee files
        `${config.paths.build}/${config.paths.framework.base}/${config.paths.framework.general.js}/**/*.coffee`,
        `${config.paths.build}/${config.paths.framework.base}/${config.paths.framework.gateway.js}/**/*.coffee`,

        // remove framework scss files
        `${config.paths.build}/${config.paths.framework.base}/${config.paths.framework.general.css}/**/*.scss`,
        `${config.paths.build}/${config.paths.framework.base}/${config.paths.framework.gateway.css}/**/*.scss`
      ])

      if (!util.isFrameworkedPaymentGateway()) {
        paths.push(`${config.paths.build}/${config.paths.framework.base}/woocommerce/payment-gateway`)
      }
    }

    return gulp.src(paths, defaultOptions).pipe(plugins.clean())
  })

  // clean WooCommerce repo dir
  gulp.task('clean:wc_repo', () => {
    return gulp.src([
      util.getWCRepoDestDir() + '*',
      '!' + util.getWCRepoDestDir() + '.*'
    ], defaultOptions).pipe(plugins.clean())
  })

  // delete prerelease
  gulp.task('clean:prerelease', () => {
    return gulp.src([
      util.getPrereleasesPath() + config.plugin.slug + '*.zip',
      util.getPrereleasesPath() + config.plugin.slug + '*.txt'
    ], defaultOptions).pipe(plugins.clean())
  })

  // alternative approach - build tasks based on conf file
  // _.each(config.tasks.clean, (task, key) => {
  //   let taskOptions = _.merge({read: false, allowEmpty: true}, task.options)
  //
  //   gulp.task('clean:' + key, () => {
  //     return gulp.src(task.src, taskOptions).pipe(plugins.clean())
  //   })
  // })
}
