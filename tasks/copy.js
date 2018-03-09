module.exports = (gulp, config, plugins, options) => {
  const util = require('../lib/utilities')(config, options)

  gulp.task('copy:build', () => {
    const filter = plugins.filter(['**/*.min.css', '**/*.min.js'], { restore: true })

    return gulp.src(`${config.paths.src}/**/*`)
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
      `${config.paths.build}/${config.plugin.slug}*.zip`,
      `${config.paths.build}/changelog.txt`
    ]).pipe(filter)
      .pipe(plugins.rename({ prefix: config.plugin.slug + '_' }))
      .pipe(filter.restore)
      .pipe(gulp.dest(util.getPrereleasesPath()))
  })

  // TODO
  // copy:deploy
}
