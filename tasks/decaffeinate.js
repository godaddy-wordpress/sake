import path from 'node:path';
import sake from '../lib/sake.js'
import gulp from 'gulp'
import browserSync from 'browser-sync'
import coffee from 'gulp-coffee'
import gulpif from 'gulp-if'
import eslint from 'gulp-eslint'
import { fileURLToPath } from 'node:url'
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Converts CoffeeScripts to ES6 JavaScript without minification or further handling.
 * This command should only be run once when converting an existing plugin CoffeeScript codebase to plain SE6.
 */
const decaffeinateTask = (done) => {
  // use WordPress standards - overrideable by individual plugins that provide a .eslintrc file
  // see https://github.com/WordPress-Coding-Standards/eslint-config-wordpress/blob/master/index.js
  let esLintFile = sake.options['eslint-configFile'] ? path.join(process.cwd(), sake.options['eslint-configFile']) : path.join(__dirname, '../lib/lintfiles/.eslintrc')
  let esLintOptions = {
    configFile: esLintFile,
    quiet: false,
    fix: true
  }

  return gulp.src(`${sake.config.paths.assetPaths.js}/**/*.coffee`)
    .pipe(coffee({ bare: true }))
    .pipe(gulp.dest(sake.config.paths.assetPaths.js))
    .pipe(eslint(esLintOptions))
    .pipe(eslint.format('table'))
    .pipe(gulp.dest(sake.config.paths.assetPaths.js))
    .pipe(gulpif(() => sake.isWatching && sake.config.tasks.watch.useBrowserSync, browserSync.stream.apply({ match: '**/*.js' })))
}
decaffeinateTask.displayName = 'decaffeinate'

export {
  decaffeinateTask
}
