module.exports = (gulp, config, plugins, options) => {
  gulp.task('compress', () => {
    const util = require('../lib/utilities')(config, options)

    let zipDest = options.zipDest || config.paths.build
    config.paths.zipDest = util.resolvePath(zipDest)

    let zipFileName = config.plugin.slug + '.' + (options.deploy ? options.deploys.version_bump : util.getPluginVersion()) + '.zip'

    return gulp.src(`${config.paths.build}/**/*`)
      .pipe(plugins.zip(zipFileName))
      .pipe(gulp.dest(zipDest))
  })

  gulp.task('zip', gulp.series('compile', 'build', 'compress'))
}
