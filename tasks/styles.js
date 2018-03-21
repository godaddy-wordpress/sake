module.exports = (gulp, config, plugins, options) => {
  // main task for (optionally) linting and compiling styles
  gulp.task('styles', (done) => {
    let tasks = ['styles:lint', 'styles:compile']

    // don't lint styles if they have already been linted, unless we're watching
    if (!config.isWatching && gulp.lastRun('styles:lint')) {
      tasks.shift()
    }

    gulp.series(tasks)(done)
  })

  // main task for compiling styles
  gulp.task('styles:compile', gulp.parallel('styles:compile_scss'))

  // main task for linting styles
  gulp.task('styles:lint', gulp.parallel('styles:lint_scss'))

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

    if (options.minify) {
      cssPlugins.push(require('cssnano')())
    }

    return gulp.src(`${config.paths.assetPaths.css}/**/*.scss`)
      .pipe(plugins.sourcemaps.init())
      .pipe(plugins.sass({ outputStyle: 'nested' }))
      .pipe(plugins.postcss(cssPlugins))
      .pipe(plugins.rename({ suffix: '.min' }))
      .pipe(plugins.sourcemaps.write('.', { includeContent: false, mapFile: (mapFilePath) => mapFilePath.replace('.css.map', '.map') })) // source map files are named *.map instead of *.js.map
      .pipe(gulp.dest(`${config.paths.src}/${config.paths.css}`))
      .pipe(plugins.if(() => config.isWatching && config.tasks.watch.useBrowserSync, plugins.browserSync.stream({match: '**/*.css'})))
  })
}
