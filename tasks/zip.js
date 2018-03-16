module.exports = (gulp, config, plugins, options) => {
  gulp.task('compress', () => {
    const util = require('../lib/utilities')(config, options)

    let zipDest = options.zipDest || config.paths.build
    let zipFileName = config.plugin.id + '.' + util.getPluginVersion() + '.zip'
    config.paths.zipDest = util.resolvePath(zipDest)

    return gulp.src([`${config.paths.build}/**/*`, `!${config.paths.build}/**/*.zip`])
      .pipe(plugins.zip(zipFileName))
      .pipe(gulp.dest(config.paths.zipDest))
  })

  gulp.task('zip', gulp.series('build', 'compress'))
}
