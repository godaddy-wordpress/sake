const path = require('path')

module.exports = (gulp, plugins, sake) => {
  // copy files from source to build
  gulp.task('copy:build', () => {
    const filter = plugins.filter(['**/*.min.css', '**/*.min.js'], { restore: true })

    let paths = [
      `${sake.config.paths.src}/**/*`,

      // skip .map files
      `!${sake.config.paths.src}/${sake.config.paths.js}/**/*.map`,
      `!${sake.config.paths.src}/${sake.config.paths.css}/**/*.map`,

      // skip coffee and unminified js files
      `!${sake.config.paths.src}/${sake.config.paths.js}/**/*.coffee`,
      `!${sake.config.paths.src}/${sake.config.paths.js}/**/*(!.min).js`,
      `!${sake.config.paths.src}/${sake.config.paths.js}/blocks/src{,/**}`,

      // skip scss and unminified css files
      `!${sake.config.paths.src}/${sake.config.paths.css}/**/*.scss`,
      `!${sake.config.paths.src}/${sake.config.paths.css}/**/*(!.min).css`,

      // skip test files
      `!${sake.config.paths.src}/**/tests{,/**}`,
      `!${sake.config.paths.src}/**/.travis.yml`,
      `!${sake.config.paths.src}/**/phpunit.xml`,
      `!${sake.config.paths.src}/**/phpunit.travis.xml`,
      `!${sake.config.paths.src}/**/docker-compose*.yml`,
      `!${sake.config.paths.src}/**/wp-bootstrap.sh`,
      `!${sake.config.paths.src}/phpcs.xml`,

      // skip composer and npm files
      `!${sake.config.paths.src}/**/composer.json`,
      `!${sake.config.paths.src}/**/composer.lock`,
      `!${sake.config.paths.src}/**/options.json`,
      `!${sake.config.paths.src}/**/package.json`,
      `!${sake.config.paths.src}/**/package-lock.json`,
      `!${sake.config.paths.src}/**/node_modules{,/**}`,
      `!${sake.config.paths.src}/**/grunt{,/**}`,

      // skip misc files
      `!${sake.config.paths.src}/**/modman`,
      `!${sake.config.paths.src}/**/Gruntfile.js`,
      `!${sake.config.paths.src}/**/sake.options.json`,
      `!${sake.config.paths.src}/**/codeception*.*`,
      `!${sake.config.paths.src}/**/*.zip`,
      `!${sake.config.paths.src}/**/*.iml`, // IDE configuration
      `!${sake.config.paths.src}/**/test.sh`,
      `!${sake.config.paths.src}/**/readme.md`,
      `!${sake.config.paths.src}/**/.{*}`, // any file starting with a dot

      // skip tartufo files
      `!${sake.config.paths.src}/**/tool.tartufo`,
      `!${sake.config.paths.src}/**/tartufo.toml`,
      `!${sake.config.paths.src}/**/exclude-patterns.txt`,

      // skip codeowners files
      `!${sake.config.paths.src}/**/CODEOWNERS`,
      `!${sake.config.paths.src}/**/codeowners`,

      // skip whitesource files
      `!${sake.config.paths.src}/**/.whitesource`,

      // skip manifest.xml
      `!${sake.config.paths.src}/manifest.xml`,

      // skip sake sake.config
      `!${sake.config.paths.src}/**/sake.config.js`
    ]

    if (sake.config.framework) {
      // skip common framework files
      paths = paths.concat([
        `!${sake.config.paths.src}/${sake.config.paths.framework.base}/*`,
        `!${sake.config.paths.src}/${sake.config.paths.framework.base}/grunt{,/**}`,
        `${sake.config.paths.src}/${sake.config.paths.framework.base}/license.txt`,
        `!${sake.config.paths.src}/${sake.config.paths.framework.base}/woocommerce/payment-gateway/templates{,/**}`
      ])

      if (sake.config.framework === 'v5') {
        // skip sample loader file
        paths.push(`!${sake.config.paths.src}/${sake.config.paths.framework.base}/woocommerce/woocommerce-framework-plugin-loader-sample.php`)
      }

      paths = paths.concat([
        // skip framework .map files
        `!${sake.config.paths.src}/${sake.config.paths.framework.base}/${sake.config.paths.framework.general.js}/**/*.map`,
        `!${sake.config.paths.src}/${sake.config.paths.framework.base}/${sake.config.paths.framework.gateway.js}/**/*.map`,
        `!${sake.config.paths.src}/${sake.config.paths.framework.base}/${sake.config.paths.framework.general.css}/**/*.map`,
        `!${sake.config.paths.src}/${sake.config.paths.framework.base}/${sake.config.paths.framework.gateway.css}/**/*.map`,

        // skip framework coffee files
        `!${sake.config.paths.src}/${sake.config.paths.framework.base}/${sake.config.paths.framework.general.js}/**/*.coffee`,
        `!${sake.config.paths.src}/${sake.config.paths.framework.base}/${sake.config.paths.framework.gateway.js}/**/*.coffee`,

        // skip framework scss files
        `!${sake.config.paths.src}/${sake.config.paths.framework.base}/${sake.config.paths.framework.general.css}/**/*.scss`,
        `!${sake.config.paths.src}/${sake.config.paths.framework.base}/${sake.config.paths.framework.gateway.css}/**/*.scss`
      ])

      if (!sake.isFrameworkedPaymentGateway()) {
        paths.push(`!${sake.config.paths.src}/${sake.config.paths.framework.base}/woocommerce/payment-gateway{,/**}`)
      }
    }

    paths = paths.concat([
      // skip misc jilt promotions files
      `!${sake.config.paths.vendor}/skyverge/wc-jilt-promotions/gulpfile.js`,
      `!${sake.config.paths.vendor}/skyverge/wc-jilt-promotions/README.md`,
    ])

    // skip copying composer dev packages
    if (sake.config.composer) {
      if (sake.config.composer['require-dev']) {
        Object.keys(sake.config.composer['require-dev']).forEach((pkg) => {

          // skip copying the dev package directory
          let packagePath = path.join(sake.config.paths.vendor, pkg)

          // if there are no other non-dev packages from the same vendor, skip the folder for the vendor itself as well
          let vendor = pkg.split('/')[0]

          if (!(sake.config.composer.require && Object.keys(sake.config.composer.require).some((pkg) => pkg.indexOf(vendor) > -1))) {
            packagePath = path.join(sake.config.paths.vendor, vendor)
          }

          paths.push(`!${packagePath}{,/**}`)
        })
      }

      // skip copying binaries
      paths.push(`!${sake.config.paths.vendor}/bin{,/**}`)

      // skip composer autoloader, unless required
      if (!sake.config.autoload && sake.config.paths.vendor) {
        paths = paths.concat([
          `!${sake.config.paths.vendor}/composer{,/**}`,
          `!${sake.config.paths.vendor}/autoload.php`
        ])
      }
    }

    // skip the WP assets dir if it's in the root
    if (sake.config.deploy.type === 'wp' && sake.config.paths.wpAssets) {
      paths.push(`!${sake.config.paths.wpAssets}{,/**}`)
    }

    // skip any custom paths
    if ( Array.isArray( sake.config.paths.exclude ) && sake.config.paths.exclude.length ) {
      sake.config.paths.exclude.forEach( (path) => {
			paths.push( `!${path}{,/**}` )
        })
    }

    return gulp.src(paths, { base: sake.config.paths.src })
      .pipe(filter)
      .pipe(plugins.replace(/^.*sourceMappingURL=.*$/mg, '')) // remove source mapping references - TODO: consider skipping sourcemaps in compilers instead when running build/deploy tasks
      .pipe(plugins.replace('\n', '')) // remove an extra line added by libsass/node-sass
      .pipe(filter.restore)
      .pipe(gulp.dest(`${sake.config.paths.build}/${sake.config.plugin.id}`))
  })

  // copy plugin zip and changelog to prereleases folder
  gulp.task('copy:prerelease', () => {
    let filename = sake.config.deploy.type === 'wp' ? 'readme' : 'changelog'

    const filter = plugins.filter([`**/${filename}.txt`], { restore: true })

    return gulp.src([
      `${sake.config.paths.build}/${sake.config.plugin.id}*.zip`,
      `${sake.config.paths.build}/${sake.config.plugin.id}/${filename}.txt`
    ]).pipe(filter)
      .pipe(plugins.rename({ prefix: sake.config.plugin.id + '_' }))
      .pipe(filter.restore)
      .pipe(gulp.dest(sake.getPrereleasesPath()))
  })

  // copy files from build to WC repo folder
  gulp.task('copy:wc_repo', () => {
    return gulp.src(`${sake.config.paths.build}/${sake.config.plugin.id}/**/*`).pipe(gulp.dest(sake.getProductionRepoPath()))
  })

  // copy files from build to WP trunk folder
  gulp.task('copy:wp_trunk', () => {
    return gulp.src(`${sake.config.paths.build}/${sake.config.plugin.id}/**/*`).pipe(gulp.dest(path.join(sake.getProductionRepoPath(), 'trunk')))
  })

  // copy files from build to WP assets folder
  gulp.task('copy:wp_assets', () => {
    return gulp.src(`${sake.config.paths.wpAssets}/**/*`).pipe(gulp.dest(path.join(sake.getProductionRepoPath(), 'assets')))
  })

  // copy files from WP trunk to tag
  gulp.task('copy:wp_tag', () => {
    return gulp.src(path.join(sake.getProductionRepoPath(), 'trunk/**/*')).pipe(gulp.dest(path.join(sake.getProductionRepoPath(), 'tags', sake.getPluginVersion())))
  })
}
