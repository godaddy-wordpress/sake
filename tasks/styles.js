// compile sass styles
module.exports = (gulp, config, plugins) => {
  gulp.task('styles', () => {
    return gulp.src(`${config.paths.assetPaths.css}/**/*.scss`)
      .pipe(plugins.sourcemaps.init())
      .pipe(plugins.sass({ outputStyle: (config.minify === true) ? 'compressed' : 'nested' }).on('error', plugins.sass.logError))
      .pipe(plugins.rename({ suffix: '.min' }))
      .pipe(plugins.sourcemaps.write('.', { mapFile: (mapFilePath) => mapFilePath.replace('.css.map', '.map') })) // source map files are named *.map instead of *.js.map
      .pipe(gulp.dest(`./${config.paths.src}/${config.paths.css}`))
      .pipe(plugins.if(() => config.isWatching && config.tasks.watch.useBrowserSync, plugins.browserSync.stream({match: '**/*.css'})))
  })
}
