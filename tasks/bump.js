import gulp from 'gulp'
import gulpif from 'gulp-if'
import replace from 'gulp-replace'
import * as sakeReplace from '../pipes/replace.js'
import sake from '../lib/sake.js'

/**
 * Bumps the version in the main plugin file to match changelog.txt
 */
const bumpTask = (done) => {
  let pluginFiles = [`${sake.config.paths.src}/${sake.config.plugin.mainFile}`]

  // also include the main Plugin class file
  if (sake.config.framework === 'v5') {
    pluginFiles.push(`${sake.config.paths.src}/includes/Plugin.php`)
  }

  return gulp.src(pluginFiles, { base: sake.config.paths.src, allowEmpty: true })
    .pipe(replace(/ \* Version: [0-9]*.[0-9]*.[0-9]*(-[a-z]+.[0-9]+)*\n/, () => ' * Version: ' + sake.getPluginVersion() + '\n'))
    .pipe(replace(/const VERSION = '[0-9]*.[0-9]*.[0-9]*(-[a-z]+.[0-9]+)*';/, () => "const VERSION = '" + sake.getPluginVersion() + "';"))
    .pipe(gulp.dest(sake.config.paths.src))
}
bumpTask.displayName = 'bump'

/**
 * Bumps the minimum requirements for the plugin.
 */
const bumpMinReqsTask = (done) => {
  // helper to determine if a number is an integer
  let isInt = (n) => {
    return n % 1 === 0
  }

  // semver-ify versions passed in as integers
  ['minimum_wp_version', 'tested_up_to_wp_version', 'minimum_wc_version', 'tested_up_to_wc_version', 'framework_version', 'backwards_compatible'].forEach((option) => {
    if (sake.options[option] && isInt(sake.options[option])) {
      sake.options[option] = parseFloat(sake.options[option]).toFixed(1)
    }
  })

  return gulp.src([`${sake.config.paths.src}/${sake.config.plugin.mainFile}`, `${sake.config.paths.src}/readme.txt`])
    // note the need to cast the version options to boolean, as passing a string version,
    // such as '4.4.0' will not evaluate to true in gulp-if
    .pipe(gulpif(Boolean(sake.options.minimum_php_version), sakeReplace.replaceMinimumPhpVersion()))
    .pipe(gulpif(Boolean(sake.options.minimum_wp_version), sakeReplace.replaceMinimumWpVersion()))
    .pipe(gulpif(Boolean(sake.options.tested_up_to_wp_version), sakeReplace.replaceTestedUptoWpVersion()))
    .pipe(gulpif(Boolean(sake.options.minimum_wc_version), sakeReplace.replaceMinimumWcVersion()))
    .pipe(gulpif(Boolean(sake.options.tested_up_to_wc_version), sakeReplace.replaceTestedUpToWcVersion()))
    .pipe(gulpif(Boolean(sake.options.framework_version), sakeReplace.replaceFrameworkVersion()))
    .pipe(gulpif(Boolean(sake.options.backwards_compatible && sake.config.framework === 'v4'), sakeReplace.replaceBackwardsCompatibleVersion()))
    .pipe(gulp.dest(sake.config.paths.src))
}
bumpMinReqsTask.displayName = 'bump:minreqs'

/**
 * Bumps the v5 framework version in plugin files
 */
const bumpFrameworkVersionTask = (done) => {
  return gulp.src([`${sake.config.paths.src}/**/*.php`, `!${sake.config.paths.src}/${sake.config.paths.framework.base}`])
    .pipe(gulpif(Boolean(sake.options.framework_version), sakeReplace.replaceFrameworkVersion()))
    .pipe(gulp.dest(sake.config.paths.src))
}
bumpFrameworkVersionTask.displayName = 'bump:framework_version'

export {
  bumpTask,
  bumpMinReqsTask,
  bumpFrameworkVersionTask
}
