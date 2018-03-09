module.exports = (gulp) => {
  // clean dev dir
  return gulp.task('build', gulp.series('clean:build_dir', 'copy:build', 'clean:build'))
}
