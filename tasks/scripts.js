const combiner = require('stream-combiner2')

// compile scripts
module.exports = (gulp, config, plugins, options, pipes) => {
  // compile coffee and minify
  gulp.task('scripts:coffee', (done) => {
    // we're using stream-combiner here so that errors do not break the watch task, see:
    // - https://github.com/gulpjs/gulp/blob/master/docs/recipes/combining-streams-to-handle-errors.md
    // - https://github.com/gulpjs/gulp/issues/784
    return combiner([
      gulp.src(`${config.paths.assetPaths.js}/**/*.coffee`),
      // plugins.if(() => config.isWatching, plugins.newer({dest: config.paths.assetPaths.js + '/**', ext: 'min.js'})),
      plugins.sourcemaps.init(),
      pipes.scripts.coffeelint(),
      // compile coffee files to JS
      plugins.coffee(),
      // transpile & minify, write sourcemaps
      pipes.scripts.minify(),
      gulp.dest(config.paths.assetPaths.js),
      plugins.if(() => config.isWatching && config.tasks.watch.useBrowserSync, plugins.browserSync.stream.apply({ match: '**/*.js' }))
    ])
    .on('end', done)
    .on('error', done)
  })

  // lint, transpile and minify js
  gulp.task('scripts:js', (done) => {
    // we're using stream-combiner here so that errors do not break the watch task, see:
    // - https://github.com/gulpjs/gulp/blob/master/docs/recipes/combining-streams-to-handle-errors.md
    // - https://github.com/gulpjs/gulp/issues/784
    return combiner([
      gulp.src(config.paths.assetPaths.javascriptSources),
      // plugins.if(() => config.isWatching, plugins.newer({dest: config.paths.assetPaths.js + '/**', ext: 'min.js'})),
      plugins.sourcemaps.init(),
      // compile coffee files to JS
      pipes.scripts.eslint(),
      // transpile & minify, write sourcemaps
      pipes.scripts.minify(),
      gulp.dest(config.paths.assetPaths.js),
      plugins.if(() => config.isWatching && config.tasks.watch.useBrowserSync, plugins.browserSync.stream.apply({ match: '**/*.js' }))
    ])
    .on('end', done)
    .on('error', done)
  })

  gulp.task('scripts', gulp.parallel('scripts:coffee', 'scripts:js'))

  gulp.task('scripts:coffeelint', (done) => {
    return gulp.src(`${config.paths.assetPaths.js}/**/*.coffee`).pipe(plugins.debug()).pipe(pipes.scripts.coffeelint()).on('end', done).on('error', done)
  })

  gulp.task('scripts:eslint', (done) => {
    return gulp.src(config.paths.assetPaths.javascriptSources).pipe(pipes.scripts.eslint()).on('end', done).on('error', done)
  })

  gulp.task('scripts:lint', gulp.parallel('scripts:coffeelint', 'scripts:eslint'))
}
