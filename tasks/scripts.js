const path = require('path')
const combiner = require('stream-combiner2')

// compile scripts
module.exports = (gulp, config, plugins, options, pipes) => {
  // the main scripts task - lints and compiles scripts
  gulp.task('scripts', gulp.parallel('scripts:coffee', 'scripts:js'))

  // type-specific script tasks - lints and then compiles
  gulp.task('scripts:coffee', gulp.series('scripts:lint_coffee', 'scripts:compile_coffee'))
  gulp.task('scripts:js', gulp.series('scripts:lint_js', 'scripts:compile_js'))

  // the main lint task
  gulp.task('scripts:lint', gulp.parallel('scripts:lint_coffee', 'scripts:lint_js'))

  // specific lint tasks
  gulp.task('scripts:lint_coffee', (done) => {
    let coffeeLintFile = options['coffeelint-file'] ? path.join(process.cwd(), options['coffeelint-file']) : null

    return gulp.src(`${config.paths.assetPaths.js}/**/*.coffee`)
      .pipe(plugins.coffeelint(coffeeLintFile))
      .pipe(plugins.coffeelint.reporter())
      .pipe(plugins.coffeelint.reporter('fail')) // fail task on errors
      .on('end', done)
      .on('error', done)
  })

  gulp.task('scripts:lint_js', () => {
    return gulp.src(config.paths.assetPaths.javascriptSources)
      .pipe(plugins.eslint({ configFile: options['eslint-configFile'] }))
      .pipe(plugins.eslint.failOnError()) // fail task on errors
  })

  // Note: ideally, we would only open a single stream of the script files, linting and compiling in the same
  // stream/task, but unfortunately it looks like this is not possible, ast least not when reporting the
  // lint errors - it results in no more files being passed down the stream, even if there were no lint errors. {IT 2018-03-14}

  // internal task to compile, transpile and minify coffee files
  gulp.task('scripts:compile_coffee', () => {
    // we're using stream-combiner here so that errors do not break the watch task, see:
    // - https://github.com/gulpjs/gulp/blob/master/docs/recipes/combining-streams-to-handle-errors.md
    // - https://github.com/gulpjs/gulp/issues/784
    return combiner([
      gulp.src(`${config.paths.assetPaths.js}/**/*.coffee`),
      // plugins.if(() => config.isWatching, plugins.newer({dest: config.paths.assetPaths.js + '/**', ext: 'min.js'})),
      plugins.sourcemaps.init(),
      // compile coffee files to JS
      plugins.coffee({ bare: true }),
      // transpile & minify, write sourcemaps
      pipes.scripts.minify(),
      gulp.dest(config.paths.assetPaths.js),
      plugins.if(() => config.isWatching && config.tasks.watch.useBrowserSync, plugins.browserSync.stream.apply({ match: '**/*.js' }))
    ])
  })

  // internal task to transpile and minify js files
  gulp.task('scripts:compile_js', () => {
    // we're using stream-combiner here so that errors do not break the watch task, see:
    // - https://github.com/gulpjs/gulp/blob/master/docs/recipes/combining-streams-to-handle-errors.md
    // - https://github.com/gulpjs/gulp/issues/784
    return combiner([
      gulp.src(config.paths.assetPaths.javascriptSources),
      // plugins.if(() => config.isWatching, plugins.newer({dest: config.paths.assetPaths.js + '/**', ext: 'min.js'})),
      plugins.sourcemaps.init(),
      // transpile & minify, write sourcemaps
      pipes.scripts.minify(),
      gulp.dest(config.paths.assetPaths.js),
      plugins.if(() => config.isWatching && config.tasks.watch.useBrowserSync, plugins.browserSync.stream.apply({ match: '**/*.js' })),
    ])
  })
}
