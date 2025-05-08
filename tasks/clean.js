const path = require('path')
const del = require('del')

module.exports = (gulp, plugins, sake) => {
  let defaultOptions = { read: false, allowEmpty: true }

  // clean dev dir from map files
  gulp.task('clean:dev', () => {
    return del([
      `${sake.config.paths.src}/${sake.config.paths.assets}/**/*.map`
    ])
  })

  // clean composer packages
  gulp.task('clean:composer', () => {
    return del([
      `${sake.config.paths.vendor}`
    ])
  })

  // clean (empty) build dir
  gulp.task('clean:build', () => {
    return del([
      `${sake.config.paths.build}/${sake.config.plugin.id}`,
      `${sake.config.paths.build}/${sake.config.plugin.id}.*.zip`
    ])
  })

  // clean WooCommerce repo dir
  gulp.task('clean:wc_repo', () => {
    // this will automatically exclude any dotfiles, such as the .git directory
    return del([
      sake.getProductionRepoPath() + '**/*'
    ])
  })

  // delete prerelease
  gulp.task('clean:prerelease', () => {
    return del([
      sake.getPrereleasesPath() + sake.config.plugin.id + '*.zip',
      sake.getPrereleasesPath() + sake.config.plugin.id + '*.txt'
    ])
  })

  // clear wp repo trunk
  gulp.task('clean:wp_trunk', () => {
    return del([
      path.join(sake.getProductionRepoPath(), 'trunk')
    ], {
      force: true // required to allow deleting outside of current working directory
    })
  })

  // clear wp repo trunk
  gulp.task('clean:wp_assets', () => {
    return del([
      path.join(sake.getProductionRepoPath(), 'assets')
    ], {
      force: true // required to allow deleting outside of current working directory
    })
  })
}
