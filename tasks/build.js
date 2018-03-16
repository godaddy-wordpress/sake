module.exports = (gulp) => {
  // main task for building the plugin:
  // - cleans the build directory
  // - compiles the plugin assets
  // - copies plugin files to the build directory
  return gulp.task('build', gulp.series('clean:build', 'compile', 'copy:build'))
}
