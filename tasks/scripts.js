const path = require('path')

// compile scripts
module.exports = (gulp, config, plugins, options, pipes) => {
  const jsFilter = plugins.filter('**/*.js', { restore: true })
  const coffeeFilter = plugins.filter('**/*.coffee', { restore: true })

  // compile coffee and plain old JS, minify
  gulp.task('scripts', () => {
    return gulp.src([`${config.paths.assetPaths.js}/**/*.{coffee,js}`, `!${config.paths.assetPaths.js}/**/*.min.js`])
      // .pipe(gulpif(() => config.isWatching, plugins.newer({dest: config.paths.assetPaths.js + '/**', ext: 'min.js'})))
      // first, lint plain JS - it's important that this comes first, as otherwise coffee > js files will also be linted, which we do not want
      .pipe(plugins.sourcemaps.init())
      .pipe(jsFilter)
      .pipe(plugins.debug())
      .pipe(pipes.scripts.eslint())
      .pipe(plugins.eslint.format()) // simply output lint errors, do not fail on them
      .pipe(jsFilter.restore)
      // compile coffee files to JS
      .pipe(coffeeFilter)
      .pipe(pipes.scripts.coffeelint())
      .pipe(coffeeFilter.restore)
      // Because CoffeeScript 2 will compile to ES6, we need to use babel to transpile it to ES2015,
      // note that this will also enable us to use ES6 in our plain JS.
      // We need to tell Babel to find the preset from this project, not from the current working directory,
      // see https://github.com/babel/babel-loader/issues/299#issuecomment-259713477.
      .pipe(plugins.babel({ presets: ['babel-preset-env'].map(require.resolve) }))
      .pipe(plugins.if(config.minify, plugins.uglify()))
      .pipe(plugins.rename({ suffix: '.min' }))
      .pipe(plugins.sourcemaps.write('.', { mapFile: (mapFilePath) => mapFilePath.replace('.js.map', '.map') })) // source map files are named *.map instead of *.js.map
      .pipe(gulp.dest(config.paths.assetPaths.js))
      .pipe(plugins.if(() => config.isWatching && config.tasks.watch.useBrowserSync, plugins.browserSync.stream.apply({ match: '**/*.js' })))
  })

  gulp.task('scripts:coffeelint', (done) => {
    return gulp.src(`${config.paths.assetPaths.js}/**/*.coffee`).pipe(plugins.debug()).pipe(pipes.scripts.coffeelint()).on('end', done)
  })

  gulp.task('scripts:eslint', (done) => {
    return gulp.src([`${config.paths.assetPaths.js}/**/*.js`, `!${config.paths.assetPaths.js}/**/*.min.js`]).pipe(pipes.scripts.eslint()).on('end', done)
  })

  gulp.task('scripts:lint', gulp.parallel('scripts:coffeelint', 'scripts:eslint'))
}
