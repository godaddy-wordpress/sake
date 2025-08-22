import path from 'node:path';
import sake from '../lib/sake.js'
import gulp from 'gulp'
import replace from 'gulp-replace'
import rename from 'gulp-rename'
import gulpFilter from 'gulp-filter'

/**
 * Copy files from source to build
 */
const copyBuildTask = (done) => {
  const filter = gulpFilter(['**/*.min.css', '**/*.min.js'], { restore: true })

  let paths = [
    `${sake.config.paths.src}/**/*`,

    // skip the directory we're building everything into!
    `!${sake.config.paths.build}{,/**}`,

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
    `!${sake.config.paths.src}/**/manifest.xml`,

    // skip build config files
    `!${sake.config.paths.src}/**/sake.config.js`,
    `!${sake.config.paths.src}/**/postcss.config.js`,
  ]

  if (sake.config.framework) {
    // skip common framework files
    paths = paths.concat([
      `!${sake.config.paths.src}/${sake.config.paths.framework.base}/*`,
      `!${sake.config.paths.src}/${sake.config.paths.framework.base}/grunt{,/**}`,
      `${sake.config.paths.src}/${sake.config.paths.framework.base}/license.txt`
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
  }

  paths = paths.concat([
    // skip misc jilt promotions files
    `!${sake.config.paths.vendor}/skyverge/wc-jilt-promotions/gulpfile.js`,
    `!${sake.config.paths.vendor}/skyverge/wc-jilt-promotions/README.md`
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
    if (!sake.config.autoload) {
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
  if (Array.isArray(sake.config.paths.exclude) && sake.config.paths.exclude.length) {
    sake.config.paths.exclude.forEach((path) => {
      paths.push(`!${path}{,/**}`)
    })
  }

  // encoding: false is required because otherwise images will become corrupted
  // @link https://github.com/gulpjs/gulp/issues/2790
  return gulp.src(paths, { base: sake.config.paths.src, allowEmpty: true, encoding: false })
    .pipe(filter)
    .pipe(replace(/\/\*# sourceMappingURL=.*?\*\/$/mg, '')) // remove source mapping references - TODO: consider skipping sourcemaps in compilers instead when running build/deploy tasks
    .pipe(replace('\n', '')) // remove an extra line added by libsass/node-sass
    .pipe(filter.restore)
    .pipe(gulp.dest(`${sake.config.paths.build}/${sake.config.plugin.id}`))
}
copyBuildTask.displayName = 'copy:build'

/**
 * Copy plugin zip and changelog to prereleases folder
 */
const copyPrereleaseTask = (done) => {
  let filename = sake.config.deploy.type === 'wp' ? 'readme' : 'changelog'

  const filter = gulpFilter([`**/${filename}.txt`], { restore: true })

  return gulp.src([
    `${sake.config.paths.build}/${sake.config.plugin.id}*.zip`,
    `${sake.config.paths.build}/${sake.config.plugin.id}/${filename}.txt`
  ]).pipe(filter)
    .pipe(rename({ prefix: sake.config.plugin.id + '_' }))
    .pipe(filter.restore)
    .pipe(gulp.dest(sake.getPrereleasesPath()))
}
copyPrereleaseTask.displayName = 'copy:prerelease'

/**
 * Copy files from build to WC repo folder
 */
const copyWcRepoTask = (done) => {
  return gulp.src(`${sake.config.paths.build}/${sake.config.plugin.id}/**/*`).pipe(gulp.dest(sake.getProductionRepoPath()))
}
copyWcRepoTask.displayName = 'copy:wc_repo'

/**
 * Copy files from build to WP trunk folder
 */
const copyWpTrunkTask = (done) => {
  return gulp.src(`${sake.config.paths.build}/${sake.config.plugin.id}/**/*`).pipe(gulp.dest(path.join(sake.getProductionRepoPath(), 'trunk')))
}
copyWpTrunkTask.displayName = 'copy:wp_trunk'

/**
 * Copy files from build to WP assets folder
 */
const copyWpAssetsTask = (done) => {
  return gulp.src(`${sake.config.paths.wpAssets}/**/*`).pipe(gulp.dest(path.join(sake.getProductionRepoPath(), 'assets')))
}
copyWpAssetsTask.displayName = 'copy:wp_assets'

/**
 * Copy files from WP trunk to tag
 */
const copyWpTagTask = (done) => {
  return gulp.src(path.join(sake.getProductionRepoPath(), 'trunk/**/*')).pipe(gulp.dest(path.join(sake.getProductionRepoPath(), 'tags', sake.getPluginVersion())))
}
copyWpTagTask.displayName = 'copy:wp_tag'

export {
  copyBuildTask,
  copyPrereleaseTask,
  copyWcRepoTask,
  copyWpTrunkTask,
  copyWpAssetsTask,
  copyWpTagTask
}
