const path = require('path')
const dottie = require('dottie')

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

      // skip test files
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
      // skip common framework files
      paths = paths.concat([
        `!${config.paths.src}/${config.paths.framework.base}/*`,
        `!${config.paths.src}/${config.paths.framework.base}/grunt{,/**}`,
        `${config.paths.src}/${config.paths.framework.base}/license.txt`,
        `!${config.paths.src}/${config.paths.framework.base}/woocommerce/payment-gateway/templates{,/**}`
      ])

      if (config.framework === 'v5') {
        // skip sample loader file
        paths.push(`!${config.paths.src}/${config.paths.framework.base}/woocommerce/woocommerce-framework-plugin-loader-sample.php`)
      }

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
    if (config.composer) {
      if (config.composer['require-dev']) {
        let vendorPath = dottie.get(config.composer, 'config.vendor-dir') || 'vendor'

        Object.keys(config.composer['require-dev']).forEach((pkg) => {
          // skip copying the dev package directory
          let packagePath = path.join(vendorPath, pkg)

          // if there are no other non-dev packages from the same vendor, skip the folder for the vendor itself as well
          let vendor = pkg.split('/')[0]

          if (!(config.composer.require && Object.keys(config.composer.require).some((pkg) => pkg.indexOf(vendor) > -1))) {
            packagePath = path.join(vendorPath, vendor)
          }

          paths.push(`!${packagePath}{,/**}`)
        })
      }

      // remove composer autoloader, unless required
      if (!config.autoload && config.paths.vendor) {
        paths = paths.concat([
          `!${config.paths.src}/${config.paths.vendor}/composer{,/**}`,
          `!${config.paths.src}/${config.paths.vendor}/autoload.php`
        ])
      }
    }

    return gulp.src(paths, { base: config.paths.src })
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
    return gulp.src(`${config.paths.build}/**/*`).pipe(gulp.dest(util.getProductionRepoPath()))
  })

  // copy files from build to WP trunk folder
  gulp.task('copy:wp_trunk', () => {
    return gulp.src(`${config.paths.build}/**/*`).pipe(gulp.dest(path.join(util.getProductionRepoPath(), 'trunk')))
  })

  // copy files from build to WP assets folder
  gulp.task('copy:wp_assets', () => {
    return gulp.src(`${config.paths.wpAssets}/**/*`).pipe(gulp.dest(path.join(util.getProductionRepoPath(), 'assets')))
  })

  // copy files from WP trunk to tag
  gulp.task('copy:wp_tag', () => {
    return gulp.src(path.join(util.getProductionRepoPath(), 'trunk/**/*')).pipe(gulp.dest(path.join(util.getProductionRepoPath(), 'tags', util.getPluginVersion())))
  })
}
