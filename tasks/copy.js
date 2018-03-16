const fs = require('fs')
const path = require('path')

module.exports = (gulp, config, plugins, options) => {
  const util = require('../lib/utilities')(config, options)

  // copy files from source to build
  gulp.task('copy:build', () => {
    const filter = plugins.filter(['**/*.min.css', '**/*.min.js'], { restore: true })

    let paths = [
      `${config.paths.src}/**/*`,

      // skip .map file
      `!${config.paths.src}/**/*.map`,

      // skip coffee and unminified js files
      `!${config.paths.src}/${config.paths.js}/**/*.coffee`,
      `!${config.paths.src}/${config.paths.js}/**/*(!.min).js`,

      // skip scss and unminified css files
      `!${config.paths.src}/${config.paths.css}/**/*.scss`,
      `!${config.paths.src}/${config.paths.css}/**/*(!.min).css`,

      // skip unit test files
      `!${config.paths.src}/**/tests{,/**}`,
      `!${config.paths.src}/**/.travis.yml`,
      `!${config.paths.src}/**/phpunit.xml`,
      `!${config.paths.src}/**/phpunit.travis.xml`,

      // skip composer and npm files
      `!${config.paths.src}/**/composer.json`,
      `!${config.paths.src}/**/composer.lock`,
      `!${config.paths.src}/**/package.json`,
      `!${config.paths.src}/**/package-lock.json`,
      `!${config.paths.src}/**/node_modules{,/**}`,
      `!${config.paths.src}/**/grunt{,/**}`,

      // skip misc files
      `!${config.paths.src}/**/modman`,
      `!${config.paths.src}/**/Gruntfile.js`,
      `!${config.paths.src}/**/options.json`,
      `!${config.paths.src}/**/codeception*.*`,
      `!${config.paths.src}/**/*.zip`,
      `!${config.paths.src}/**/test.sh`,
      `!${config.paths.src}/**/.{*}`, // any file starting with a dot

      // skip sake config
      `!${config.paths.src}/**/sake.config.js`
    ]

    if (config.framework) {
      if (config.framework === 'v4') {
        paths = paths.concat([
          // skip common framework v4 files
          `!${config.paths.src}/${config.paths.framework.base}/*`,
          `!${config.paths.src}/${config.paths.framework.base}/grunt{,/**}`,
          `${config.paths.src}/${config.paths.framework.base}/license.txt`,
          `!${config.paths.src}/${config.paths.framework.base}/woocommerce/payment-gateway/templates{,/**}`
        ])
      }

      // TODO: properly implement this
      // if (config.framework === 'v5') {
      //   // TODO: read vendor dir from composer.json
      //   paths = paths.concat([
      //     // remove common framework v5 files
      //     // - we have to do a little dance here to make sure the woocommerce folder isn't deleted
      //     `${config.paths.src}/*/vendor/composer/**`,
      //     `${config.paths.build}/*/vendor/autoload.php`,
      //     `${config.paths.build}/${config.paths.framework.base}/**`,
      //     `!${config.paths.build}/${config.paths.framework.base}/woocommerce/**`,
      //     `!${config.paths.build}/${config.paths.framework.base}/license.txt`,
      //
      //     // delete v5 sample loader file
      //     `${config.paths.build}/${config.paths.framework.base}/woocommerce/woocommerce-framework-plugin-loader-sample.php`
      //   ])
      // }

      paths = paths.concat([
        // skip framework coffee files
        `!${config.paths.src}/${config.paths.framework.base}/${config.paths.framework.general.js}/**/*.coffee`,
        `!${config.paths.src}/${config.paths.framework.base}/${config.paths.framework.gateway.js}/**/*.coffee`,

        // skip framework scss files
        `!${config.paths.src}/${config.paths.framework.base}/${config.paths.framework.general.css}/**/*.scss`,
        `!${config.paths.src}/${config.paths.framework.base}/${config.paths.framework.gateway.css}/**/*.scss`
      ])

      if (!util.isFrameworkedPaymentGateway()) {
        paths.push(`!${config.paths.src}/${config.paths.framework.base}/woocommerce/payment-gateway{,/**}`)
      }
    }

    // skip copying composer dev packages
    let composerFilePath = path.join(process.cwd(), 'composer.json')
    if (fs.existsSync(composerFilePath)) {
      let composerFile = require(composerFilePath)

      if (composerFile['require-dev']) {
        let vendorDir = composerFile.config && composerFile.config['vendor-dir'] ? composerFile.config['vendor-dir'] : 'vendor'

        Object.keys(composerFile['require-dev']).forEach((package) => {
          // skip the package directory
          let packagePath = path.join( vendorDir, package )

          // if there are no non-dev packages from the same vendor, skip the folder for the vendor itself as well
          let vendor = package.split('/')[0]
          let skipVendorDir = !composerFile.require || !Object.keys(composerFile.require).some((package) => {package.indexOf(vendor) > -1})

          if (skipVendorDir) {
            packagePath = path.join( vendorDir, vendor )
          }

          paths.push(`!${packagePath}{,/**}`)
        })
      }
    }

    return gulp.src(paths, { base: './' })
      .pipe(filter)
      .pipe(plugins.replace(/^.*sourceMappingURL=.*$/mg, '')) // remove source mapping references - TODO: consider skipping sourcemaps in compilers instead when running build/deploy tasks
      .pipe(plugins.replace('\n', '')) // remove an extra line added by libsass/node-sass
      .pipe(filter.restore)
      .pipe(gulp.dest(config.paths.build))
  })

  // copy plugin zip and changelog to prereleases folder
  gulp.task('copy:prerelease', () => {
    const filter = plugins.filter(['**/changelog.txt'], { restore: true })

    return gulp.src([
      `${config.paths.build}/${config.plugin.id}*.zip`,
      `${config.paths.build}/changelog.txt`
    ]).pipe(filter)
      .pipe(plugins.rename({ prefix: config.plugin.id + '_' }))
      .pipe(filter.restore)
      .pipe(gulp.dest(util.getPrereleasesPath()))
  })

  // copy files from build to WC repo folder
  gulp.task('copy:wc_repo', () => {
    return gulp.src(`${config.paths.build}/**/*`).pipe(gulp.dest(util.getWCRepoPath()))
  })
}
