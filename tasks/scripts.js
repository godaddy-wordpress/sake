const path = require('path')

// compile scripts
module.exports = (gulp, config, plugins, options, pipes) => {
  // main task for (optionally) linting and compiling scripts
  gulp.task('scripts', (done) => {
    let tasks = ['scripts:lint', 'scripts:compile']

    // don't lint styles if they have already been linted, unless we're watching
    if (!config.isWatching && gulp.lastRun('scripts:lint')) {
      tasks.shift()
    }

    gulp.series(tasks)(done)
  })

  // type-specific script tasks - lints and then compiles
  gulp.task('scripts:coffee', gulp.series('scripts:lint_coffee', 'scripts:compile_coffee'))
  gulp.task('scripts:js', gulp.series('scripts:lint_js', 'scripts:compile_js'))

  // the main compile task
  gulp.task('scripts:compile', gulp.parallel('scripts:compile_coffee', 'scripts:compile_js'))

  // the main lint task
  gulp.task('scripts:lint', gulp.parallel('scripts:lint_coffee', 'scripts:lint_js'))

  // specific lint tasks
  gulp.task('scripts:lint_coffee', (done) => {
    let coffeeLintFile = options['coffeelint-file'] ? path.join(process.cwd(), options['coffeelint-file']) : path.join(__dirname, '../lib/lintfiles/coffeelint.json')

    return gulp.src(`${config.paths.assetPaths.js}/**/*.coffee`)
      .pipe(plugins.coffeelint(coffeeLintFile))
      .pipe(plugins.coffeelint.reporter())
      .pipe(plugins.coffeelint.reporter('fail')) // fail task on errors
      .on('end', done)
      .on('error', done)
  })

  gulp.task('scripts:lint_js', () => {
    let esLintFile = options['eslint-configFile'] ? path.join(process.cwd(), options['eslint-configFile']) : path.join(__dirname, '../lib/lintfiles/.eslintrc')

    return gulp.src(config.paths.assetPaths.javascriptSources)
      .pipe(plugins.eslint({ configFile: esLintFile }))
      .pipe(plugins.eslint.failOnError()) // fail task on errors
  })

  // Note: ideally, we would only open a single stream of the script files, linting and compiling in the same
  // stream/task, but unfortunately it looks like this is not possible, ast least not when reporting the
  // lint errors - it results in no more files being passed down the stream, even if there were no lint errors. {IT 2018-03-14}

  console.log(config.paths.assetPaths.js)

  // internal task to compile, transpile and minify coffee files
  gulp.task('scripts:compile_coffee', () => {
    return gulp.src(`${config.paths.assetPaths.js}/**/*.coffee`)
      // plugins.if(() => config.isWatching, plugins.newer({dest: config.paths.assetPaths.js + '/**', ext: 'min.js'})),
      .pipe(plugins.sourcemaps.init())
      // compile coffee files to JS
      .pipe(plugins.coffee({ bare: true }))
      // transpile & minify, write sourcemaps
      .pipe(pipes.scripts.minify())
      .pipe(gulp.dest(config.paths.assetPaths.js))
      .pipe(plugins.if(() => config.isWatching && config.tasks.watch.useBrowserSync, plugins.browserSync.stream.apply({ match: '**/*.js' })))
  })

  // internal task to transpile and minify js files
  gulp.task('scripts:compile_js', () => {
    return gulp.src(config.paths.assetPaths.javascriptSources)
      // plugins.if(() => config.isWatching, plugins.newer({dest: config.paths.assetPaths.js + '/**', ext: 'min.js'})),
      .pipe(plugins.sourcemaps.init())
      // transpile & minify, write sourcemaps
      .pipe(pipes.scripts.minify())
      .pipe(gulp.dest(config.paths.assetPaths.js))
      .pipe(plugins.if(() => config.isWatching && config.tasks.watch.useBrowserSync, plugins.browserSync.stream.apply({ match: '**/*.js' })))
  })
}
