import webpack from 'webpack-stream';
import fs from 'node:fs';
import path from 'node:path';
import * as dartSaas from 'sass';
import gulpSaas from 'gulp-sass';
import autoprefixer from 'autoprefixer';
import gulp from 'gulp'
import gulpif from 'gulp-if'
import coffee from 'gulp-coffee'
import sourcemaps from 'gulp-sourcemaps'
import cssnano from 'cssnano'
import postcss from 'gulp-postcss'
import browserSync from 'browser-sync'
import { scriptPipes } from '../pipes/scripts.js';
import sake from '../lib/sake.js'
import rename from 'gulp-rename'
import { lintPhpTask } from './lint.js'
import { minifyImagesTask } from './imagemin.js'
import { makepotTask } from './makepot.js'
import { stylesTask } from './styles.js'
import { skipLinting } from '../helpers/arguments.js';
const sass = gulpSaas(dartSaas);

/************************** Scripts */

/**
 * Compile, transpile, and minify coffee scripts
 */
const compileCoffeeTask = (done) => {
  if (! fs.existsSync(sake.config.paths.assetPaths.js)) {
    return Promise.resolve()
  }

  return gulp.src(`${sake.config.paths.assetPaths.js}/**/*.coffee`)
    .pipe(sourcemaps.init())
    // compile coffee files to JS
    .pipe(coffee({ bare: false }))
    // transpile & minify, write sourcemaps
    .pipe(scriptPipes().compileJs())
    .pipe(gulp.dest(sake.config.paths.assetPaths.js))
    .pipe(gulpif(() => sake.isWatching && sake.config.tasks.watch.useBrowserSync, browserSync.stream.apply({ match: '**/*.js' })))
}
compileCoffeeTask.displayName = 'compile:coffee'

/**
 * Transpile and minify JS files
 */
const compileJsTask = (done) => {
  if (! fs.existsSync(sake.config.paths.assetPaths.js)) {
    return Promise.resolve()
  }

  return gulp.src(sake.config.paths.assetPaths.javascriptSources)
    // plugins.if(() => sake.isWatching, plugins.newer({dest: sake.config.paths.assetPaths.js + '/**', ext: 'min.js'})),
    .pipe(sourcemaps.init())
    // transpile & minify, write sourcemaps
    .pipe(scriptPipes().compileJs())
    .pipe(gulp.dest(sake.config.paths.assetPaths.js))
    .pipe(gulpif(() => sake.isWatching && sake.config.tasks.watch.useBrowserSync, browserSync.stream.apply({ match: '**/*.js' })))
}
compileJsTask.displayName = 'compile:js'

/**
 * This task is specific for plugins that add one or more self-contained Gutenberg blocks in their assets to be transpiled from ES6
 */
const compileBlocksTask = (done) => {
  const i18nPath = `${process.cwd()}/i18n/languages/blocks/`
  const blockPath = `${sake.config.paths.assetPaths.js}/blocks/src/`
  const blockSrc = fs.existsSync(blockPath) ? fs.readdirSync(blockPath).filter(function (file) {
    return file.match(/.*\.js$/)
  }) : false

  if (!blockSrc || blockSrc[0].length <= 0) {
    return Promise.resolve()
  } else {
    return gulp.src(sake.config.paths.assetPaths.blockSources)
      .pipe(sourcemaps.init())
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
      .pipe(gulpif(() => sake.isWatching && sake.config.tasks.watch.useBrowserSync, browserSync.stream.apply({ match: '**/*.js' })))
  }
}
compileBlocksTask.displayName = 'compile:blocks'

/************************** Styles */

/**
 * Compile SCSS to CSS
 */
const compileScssTask = (done) => {
  if (! fs.existsSync(sake.config.paths.assetPaths.css)) {
    return Promise.resolve()
  }

  let cssPlugins = [autoprefixer()]

  if (sake.options.minify) {
    cssPlugins.push(cssnano({ zindex: false }))
  }

  return gulp.src([
    `${sake.config.paths.assetPaths.css}/**/*.scss`,
    `!${sake.config.paths.assetPaths.css}/**/mixins.scss` // don't compile any mixins by themselves
  ])
    .pipe(sourcemaps.init())
    .pipe(sass({ outputStyle: 'expanded' }))
    .pipe(postcss(cssPlugins))
    .pipe(rename({ suffix: '.min' }))
    // ensure admin/ and frontend/ are removed from the source paths
    // see https://www.npmjs.com/package/gulp-sourcemaps#alter-sources-property-on-sourcemaps
    .pipe(sourcemaps.mapSources((sourcePath) => '../' + sourcePath))
    .pipe(sourcemaps.write('.', { includeContent: false }))
    .pipe(gulp.dest(`${sake.config.paths.src}/${sake.config.paths.css}`))
    .pipe(gulpif(() => sake.isWatching && sake.config.tasks.watch.useBrowserSync, browserSync.stream({match: '**/*.css'})))
}
compileScssTask.displayName = 'compile:scss'

/************************** Parallels */

// The main task to compile scripts
const compileScripts = gulp.parallel(compileCoffeeTask, compileJsTask, compileBlocksTask)
compileScripts.displayName = 'compile:scripts'

// The main task to compile styles
const compileStyles = gulp.parallel(compileScssTask)
compileStyles.displayName = 'compile:styles'

// Compile all plugin assets
const compile = (done) => {
  // default compile tasks
  let tasks = ['scripts', stylesTask, minifyImagesTask] // NOTE: do not import the `scripts` constant here, otherwise it creates a circular dependency

  // lint PHP unless told not to
  if (! skipLinting) {
    tasks.push(lintPhpTask)
  }

  // unless exclusively told not to, generate the POT file as well
  if (!sake.options.skip_pot) {
    tasks.push(makepotTask)
  }

  gulp.parallel(tasks)(done)
}

export {
  compileCoffeeTask,
  compileJsTask,
  compileBlocksTask,
  compileScssTask,
  compileScripts,
  compileStyles,
  compile
}
