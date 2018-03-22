module.exports = (gulp, config, plugins, options) => {
  const pipes = require('../pipes/scripts.js')(config, plugins, options)

  // compile plugin assets
  gulp.task('compile', (done) => {
    // default compile tasks
    let tasks = ['lint:php', 'scripts', 'styles', 'imagemin']

    // unless exclusively told not to, generate the POT file as well
    if (!options.skip_pot) {
      tasks.push('makepot')
    }

    gulp.parallel(tasks)(done)
  })

  /** Scripts */

  // the main task to compile scripts
  gulp.task('compile:scripts', gulp.parallel('compile:coffee', 'compile:js'))

  // Note: ideally, we would only open a single stream of the script files, linting and compiling in the same
  // stream/task, but unfortunately it looks like this is not possible, ast least not when reporting the
  // lint errors - it results in no more files being passed down the stream, even if there were no lint errors. {IT 2018-03-14}

  // compile, transpile and minify coffee files
  gulp.task('compile:coffee', () => {
    return gulp.src(`${config.paths.assetPaths.js}/**/*.coffee`)
      // plugins.if(() => config.isWatching, plugins.newer({dest: config.paths.assetPaths.js + '/**', ext: 'min.js'})),
      .pipe(plugins.sourcemaps.init())
      // compile coffee files to JS
      .pipe(plugins.coffee({ bare: false }))
      // transpile & minify, write sourcemaps
      .pipe(pipes.compileJs())
      .pipe(gulp.dest(config.paths.assetPaths.js))
      .pipe(plugins.if(() => config.isWatching && config.tasks.watch.useBrowserSync, plugins.browserSync.stream.apply({ match: '**/*.js' })))
  })

  // transpile and minify js files
  gulp.task('compile:js', () => {
    return gulp.src(config.paths.assetPaths.javascriptSources)
      // plugins.if(() => config.isWatching, plugins.newer({dest: config.paths.assetPaths.js + '/**', ext: 'min.js'})),
      .pipe(plugins.sourcemaps.init())
      // transpile & minify, write sourcemaps
      .pipe(pipes.compileJs())
      .pipe(gulp.dest(config.paths.assetPaths.js))
      .pipe(plugins.if(() => config.isWatching && config.tasks.watch.useBrowserSync, plugins.browserSync.stream.apply({ match: '**/*.js' })))
  })

  /** Styles */

  // main task for compiling styles
  gulp.task('compile:styles', gulp.parallel('compile:scss'))

  // compile SCSS to CSS
  gulp.task('compile:scss', () => {
    let cssPlugins = [require('autoprefixer')()]

    if (options.minify) {
      cssPlugins.push(require('cssnano')())
    }

    return gulp.src(`${config.paths.assetPaths.css}/**/*.scss`)
      .pipe(plugins.sourcemaps.init())
      .pipe(plugins.sass({ outputStyle: 'nested' }))
      .pipe(plugins.postcss(cssPlugins))
      .pipe(plugins.rename({ suffix: '.min' }))
      // ensure admin/ and frontend/ are removed from the source paths
      // see https://www.npmjs.com/package/gulp-sourcemaps#alter-sources-property-on-sourcemaps
      .pipe(plugins.sourcemaps.mapSources((sourcePath, file) => '../' + sourcePath))
      .pipe(plugins.sourcemaps.write('.', { mapFile: (mapFilePath) => mapFilePath.replace('.css.map', '.map') })) // source map files are named *.map instead of *.js.map
      .pipe(gulp.dest(`${config.paths.src}/${config.paths.css}`))
      .pipe(plugins.if(() => config.isWatching && config.tasks.watch.useBrowserSync, plugins.browserSync.stream({match: '**/*.css'})))
  })
}
