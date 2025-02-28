const webpack = require('webpack-stream')
const fs = require('fs')
const path = require('path')
const sass = require('gulp-sass')(require('sass'))

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
  gulp.task('compile:scripts', gulp.parallel('compile:coffee', 'compile:js', 'compile:blocks'))

  // Note: ideally, we would only open a single stream of the script files, linting and compiling in the same
  // stream/task, but unfortunately it looks like this is not possible, ast least not when reporting the
  // lint errors - it results in no more files being passed down the stream, even if there were no lint errors. {IT 2018-03-14}

  // compile, transpile and minify coffee files
  gulp.task('compile:coffee', () => {
    if (! fs.existsSync(sake.config.paths.assetPaths.js)) {
      return Promise.resolve()
    }

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
    if (! fs.existsSync(sake.config.paths.assetPaths.js)) {
      return Promise.resolve()
    }

    return gulp.src(sake.config.paths.assetPaths.javascriptSources)
      // plugins.if(() => sake.isWatching, plugins.newer({dest: sake.config.paths.assetPaths.js + '/**', ext: 'min.js'})),
      .pipe(plugins.sourcemaps.init())
      // transpile & minify, write sourcemaps
      .pipe(pipes.compileJs())
      .pipe(gulp.dest(sake.config.paths.assetPaths.js))
      .pipe(plugins.if(() => sake.isWatching && sake.config.tasks.watch.useBrowserSync, plugins.browserSync.stream.apply({ match: '**/*.js' })))
  })

  // this task is specific for plugins that add one or more self-contained Gutenberg blocks in their assets to be transpiled from ES6
  gulp.task('compile:blocks', () => {
    const i18nPath = `${process.cwd()}/i18n/languages/blocks/`
    const blockPath = `${sake.config.paths.assetPaths.js}/blocks/src/`
    const blockSrc = fs.existsSync(blockPath) ? fs.readdirSync(blockPath).filter(function (file) {
      return file.match(/.*\.js$/)
    }) : false

    if (!blockSrc || blockSrc[0].length <= 0) {
      return Promise.resolve()
    } else {
      return gulp.src(sake.config.paths.assetPaths.blockSources)
        .pipe(plugins.sourcemaps.init())
        .pipe(webpack({
          mode: 'production',
          entry: `${blockPath}/${blockSrc[0]}`,
          output: {
            filename: path.basename(blockSrc[0], '.js') + '.min.js'
          },
          externals: {
            'react': 'React',
            'react-dom': 'ReactDOM'
          },
          module: {
            rules: [{
              test: /\.js$/,
              exclude: /node_modules/,
              use: {
                loader: 'babel-loader',
                options: {
                  presets: ['@babel/preset-env', '@babel/preset-react'],
                  plugins: [
                    ['@wordpress/babel-plugin-makepot', { 'output': `${i18nPath}${blockSrc[0].replace('.js', '.pot')}` }]
                  ]
                }
              }
            }]
          }
        }))
        .pipe(gulp.dest(`${sake.config.paths.assetPaths.js}/blocks/`))
        .pipe(plugins.if(() => sake.isWatching && sake.config.tasks.watch.useBrowserSync, plugins.browserSync.stream.apply({ match: '**/*.js' })))
    }
  })

  /** Styles */

  // main task for compiling styles
  gulp.task('compile:styles', gulp.parallel('compile:scss'))

  // compile SCSS to CSS
  gulp.task('compile:scss', () => {
    if (! fs.existsSync(sake.config.paths.assetPaths.css)) {
      return Promise.resolve()
    }

    let cssPlugins = [require('autoprefixer')()]

    if (sake.options.minify) {
      cssPlugins.push(require('cssnano')({ zindex: false }))
    }

    return gulp.src([
      `${sake.config.paths.assetPaths.css}/**/*.scss`,
      `!${sake.config.paths.assetPaths.css}/**/mixins.scss` // don't compile any mixins by themselves
    ])
      .pipe(plugins.sourcemaps.init())
      .pipe(sass({ outputStyle: 'expanded' }))
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
