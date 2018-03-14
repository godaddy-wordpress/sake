module.exports = (gulp, config, plugins, options, pipes) => {
  // main task for compiling styles
  gulp.task('styles', gulp.series('styles:lint_scss', 'styles:compile_scss'))

  // lint SCSS
  gulp.task('styles:lint_scss', (done) => {
    return gulp.src(`${config.paths.assetPaths.css}/**/*.scss`)
      .pipe(plugins.sassLint())
      .pipe(plugins.sassLint.failOnError()) // fail task on errors
      // explicitly setting end and error event handlers will give us cleaner error logging
      .on('end', done)
      .on('error', done)
  })

  // compile SCSS to CSS
  gulp.task('styles:compile_scss', () => {
    let cssPlugins = [require('autoprefixer')()]

    if (config.minify) {
      cssPlugins.push(require('cssnano')())
    }

    return gulp.src(`${config.paths.assetPaths.css}/**/*.scss`)
      .pipe(plugins.sourcemaps.init())
      .pipe(plugins.sass({ outputStyle: 'nested' }))
      .pipe(plugins.postcss(cssPlugins))
      .pipe(plugins.rename({ suffix: '.min' }))
      .pipe(plugins.sourcemaps.write('.', { mapFile: (mapFilePath) => mapFilePath.replace('.css.map', '.map') })) // source map files are named *.map instead of *.js.map
      .pipe(gulp.dest(`./${config.paths.src}/${config.paths.css}`))
      .pipe(plugins.if(() => config.isWatching && config.tasks.watch.useBrowserSync, plugins.browserSync.stream({match: '**/*.css'})))
  })
}
