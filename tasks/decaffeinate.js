module.exports = (gulp, plugins, sake) => {

  // converts CoffeeScripts to ES6 JavaScript without minification or further handling
  gulp.task('decaffeinate', () => {
    return gulp.src(`${sake.config.paths.assetPaths.js}/**/*.coffee`)
      .pipe(plugins.coffee({ bare: false }))
  })
}
