const path = require('path')

module.exports = (gulp, plugins, sake) => {

  // converts CoffeeScripts to ES6 JavaScript without minification or further handling:
  // this command should only be run once when converting an existing plugin CoffeeScript codebase to plain ES6
  gulp.task('decaffeinate', () => {
    // use WordPress standards - overrideable by individual plugins that provide a .eslintrc file
    // see https://github.com/WordPress-Coding-Standards/eslint-config-wordpress/blob/master/index.js
    let esLintFile = sake.options['eslint-configFile'] ? path.join(process.cwd(), sake.options['eslint-configFile']) : path.join(__dirname, '../lib/lintfiles/.eslintrc')
    let esLintOptions = {
      configFile: esLintFile,
      quiet: false,
      fix: true
    }

    return gulp.src(`${sake.config.paths.assetPaths.js}/**/*.coffee`)
      .pipe(plugins.coffee({ bare: true }))
      .pipe(gulp.dest(sake.config.paths.assetPaths.js))
      .pipe(plugins.eslint(esLintOptions))
      .pipe(plugins.eslint.format('table'))
      .pipe(gulp.dest(sake.config.paths.assetPaths.js))
      .pipe(plugins.if(() => sake.isWatching && sake.config.tasks.watch.useBrowserSync, plugins.browserSync.stream.apply({ match: '**/*.js' })))
  })
}
