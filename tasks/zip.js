module.exports = (gulp, plugins, sake) => {
  gulp.task('compress', () => {
    let zipDest = sake.options.zipDest || sake.config.paths.build
    let zipFileName = sake.config.plugin.id + '.' + sake.getPluginVersion() + '.zip'

    sake.config.paths.zipDest = sake.resolvePath(zipDest)

    return gulp.src([
      `${sake.config.paths.build}/${sake.config.plugin.id}/**`,
      `!${sake.config.paths.build}/${sake.config.plugin.id}/**/*.zip`
    ], { nodir: true, base: sake.config.paths.build }) // exclude empty directories, include plugin dir in zip
      .pipe(plugins.zip(zipFileName))
      .pipe(gulp.dest(sake.config.paths.zipDest))
  })

  gulp.task('zip', gulp.series('build', 'compress'))
}
