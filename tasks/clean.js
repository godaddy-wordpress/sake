const path = require('path')

module.exports = (gulp, config, plugins, options) => {
  const util = require('../lib/utilities')(config, options)

  let defaultOptions = { read: false, allowEmpty: true }

  // clean dev dir from map files
  gulp.task('clean:dev', () => {
    return gulp.src(`${config.paths.src}/${config.paths.assets}/**/*.map`, defaultOptions).pipe(plugins.clean())
  })

  // clean (empty) build dir
  gulp.task('clean:build', () => {
    return gulp.src(config.paths.build, defaultOptions).pipe(plugins.clean({ force: true }))
  })

  // clean WooCommerce repo dir
  gulp.task('clean:wc_repo', () => {
    return gulp.src([
      util.getWCRepoPath() + '*',
      '!' + util.getWCRepoPath() + '.*'
    ], defaultOptions).pipe(plugins.clean({ force: true }))
  })

  // delete prerelease
  gulp.task('clean:prerelease', () => {
    return gulp.src([
      util.getPrereleasesPath() + config.plugin.id + '*.zip',
      util.getPrereleasesPath() + config.plugin.id + '*.txt'
    ], defaultOptions).pipe(plugins.clean({ force: true }))
  })

  // clear wp repo trunk
  gulp.task('clean:wp_trunk', () => {
    return gulp.src(path.join(util.getWPRepoPath(), 'trunk'), defaultOptions).pipe(plugins.clean({ force: true }))
  })

  // clear wp repo trunk
  gulp.task('clean:wp_assets', () => {
    return gulp.src(path.join(util.getWPRepoPath(), 'assets'), defaultOptions).pipe(plugins.clean({ force: true }))
  })
}
