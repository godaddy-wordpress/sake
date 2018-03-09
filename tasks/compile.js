module.exports = (gulp, config, plugins) => {
  // compiles plugin assets
  gulp.task('compile', gulp.parallel('scripts', 'styles', 'imagemin'))
}
