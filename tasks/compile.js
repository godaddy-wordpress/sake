module.exports = (gulp, config, plugins, options) => {
  // compiles plugin assets
  gulp.task('compile', (done) => {
    // default compile tasks
    let tasks = ['scripts', 'styles', 'imagemin']

    // unless exclusively told not to, generate the POT file as well
    if (!options.skip_pot) {
      tasks.push('makepot')
    }

    gulp.parallel(tasks)(done)
  })
}
