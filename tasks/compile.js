module.exports = (gulp, plugins, sake) => {
  const pipes = require('../pipes/scripts.js')(plugins, sake)

  // compile plugin assets
  gulp.task('compile', (done) => {
    // default compile tasks
    let tasks = ['lint:php', 'scripts', 'styles', 'imagemin']

    // unless exclusively told not to, generate the POT file as well
    if (!sake.options.skip_pot) {
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
    return gulp.src(`${sake.config.paths.assetPaths.js}/**/*.coffee`)
      // plugins.if(() => sake.isWatching, plugins.newer({dest: sake.config.paths.assetPaths.js + '/**', ext: 'min.js'})),
      .pipe(plugins.sourcemaps.init())
      // compile coffee files to JS
      .pipe(plugins.coffee({ bare: false }))
      // transpile & minify, write sourcemaps
      .pipe(pipes.compileJs())
      .pipe(gulp.dest(sake.config.paths.assetPaths.js))
      .pipe(plugins.if(() => sake.isWatching && sake.config.tasks.watch.useBrowserSync, plugins.browserSync.stream.apply({ match: '**/*.js' })))
  })

  // transpile and minify js files
  gulp.task('compile:js', () => {
    return gulp.src(sake.config.paths.assetPaths.javascriptSources)
      // plugins.if(() => sake.isWatching, plugins.newer({dest: sake.config.paths.assetPaths.js + '/**', ext: 'min.js'})),
      .pipe(plugins.sourcemaps.init())
      // transpile & minify, write sourcemaps
      .pipe(pipes.compileJs())
      .pipe(gulp.dest(sake.config.paths.assetPaths.js))
      .pipe(plugins.if(() => sake.isWatching && sake.config.tasks.watch.useBrowserSync, plugins.browserSync.stream.apply({ match: '**/*.js' })))
  })

  /** Styles */

  // main task for compiling styles
  gulp.task('compile:styles', gulp.parallel('compile:scss'))

  // compile SCSS to CSS
  gulp.task('compile:scss', () => {
    let cssPlugins = [require('autoprefixer')()]

    if (sake.options.minify) {
      cssPlugins.push(require('cssnano')({ zindex: false }))
    }

    return gulp.src([
      `${sake.config.paths.assetPaths.css}/**/*.scss`,
      `!${sake.config.paths.assetPaths.css}/**/mixins.scss` // don't compile any mixins by themselves
    ])
      .pipe(plugins.sourcemaps.init())
      .pipe(plugins.sass({ outputStyle: 'nested' }))
      .pipe(plugins.postcss(cssPlugins))
      .pipe(plugins.rename({ suffix: '.min' }))
      // ensure admin/ and frontend/ are removed from the source paths
      // see https://www.npmjs.com/package/gulp-sourcemaps#alter-sources-property-on-sourcemaps
      .pipe(plugins.sourcemaps.mapSources((sourcePath) => '../' + sourcePath))
      .pipe(plugins.sourcemaps.write('.', { includeContent: false }))
      .pipe(gulp.dest(`${sake.config.paths.src}/${sake.config.paths.css}`))
      .pipe(plugins.if(() => sake.isWatching && sake.config.tasks.watch.useBrowserSync, plugins.browserSync.stream({match: '**/*.css'})))
  })
}
