import path from 'node:path'
import dottie from 'dottie'
import fs from 'node:fs'
import log from 'fancy-log'
import * as gulp from 'gulp'
import sake from '../lib/sake.js'
import phplint from 'gulp-phplint'
import coffeelint from 'gulp-coffeelint'
import { ESLint } from 'eslint'
import postcss from 'gulp-postcss'
import stylelint from 'stylelint'
import scssSyntax from 'postcss-scss'
import gulpif from 'gulp-if'
import { fileURLToPath } from 'node:url'
import { shouldFix, shouldSkipLinting, shouldFailOnLintErrors, shouldShowFiles } from '../helpers/arguments.js'
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Shared ESLint functionality for linting JavaScript files
 * @param {string|string[]} filePatternsOrPaths - Glob patterns or file paths to lint
 * @param {Object} options - Linting options
 * @param {boolean} options.fix - Whether to auto-fix issues
 * @param {boolean} options.failOnErrors - Whether to throw on errors (default: false)
 * @param {string} options.configFile - Path to ESLint config file (optional, uses default if not provided)
 * @param {string} options.taskName - Name for logging (default: 'ESLint')
 * @returns {Promise<Object>} - Results summary with error/warning counts
 */
async function runESLint(filePatternsOrPaths, options = {}) {
  const {
    fix = false,
    failOnErrors = false,
    configFile,
    taskName = 'ESLint'
  } = options;

  // Resolve ESLint config file - use WordPress standards, overrideable by individual plugins
  const esLintFile = configFile ||
    (sake.config.tasks.lint.eslintConfigFile ?
      path.join(process.cwd(), sake.config.tasks.lint.eslintConfigFile) :
      path.join(__dirname, '../lib/lintfiles/.eslintrc.js'));

  const eslint = new ESLint({
    overrideConfigFile: esLintFile,
    fix: fix
  });

  // Resolve file patterns to actual paths if needed
  let filesToLint;
  if (typeof filePatternsOrPaths === 'string' || Array.isArray(filePatternsOrPaths)) {
    if (typeof filePatternsOrPaths === 'string' && !filePatternsOrPaths.includes('*')) {
      // Single file path, use directly
      filesToLint = [filePatternsOrPaths];
    } else {
      // Glob patterns, resolve with globby
      const { globby } = await import('globby');
      filesToLint = await globby(Array.isArray(filePatternsOrPaths) ? filePatternsOrPaths : [filePatternsOrPaths]);
    }
  } else {
    filesToLint = filePatternsOrPaths;
  }

  // If no files match the patterns, skip linting
  if (filesToLint.length === 0) {
    log.info(`No JavaScript files found to lint for ${taskName}`);
    return { errorCount: 0, warningCount: 0, fixableCount: 0 };
  }

  const results = await eslint.lintFiles(filesToLint);

  // Report auto-fix results if fixes were applied
  if (fix) {
    // Count files that had fixes applied (have 'output' property)
    const filesWithFixes = results.filter(result => result.output !== undefined);


    // Apply fixes to disk - ESLint constructor fix:true only fixes in memory!
    if (filesWithFixes.length > 0) {
      await ESLint.outputFixes(results);
      log.info(`✓ Auto-fix applied to ${filesWithFixes.length} file(s)`);

      // Count remaining fixable issues (what couldn't be auto-fixed)
      const remainingFixableErrors = results.reduce((sum, result) => sum + result.fixableErrorCount, 0);
      const remainingFixableWarnings = results.reduce((sum, result) => sum + result.fixableWarningCount, 0);
      const remainingFixable = remainingFixableErrors + remainingFixableWarnings;

      if (remainingFixable > 0) {
        log.info(`ℹ ${remainingFixable} issue(s) could not be auto-fixed and require manual fixes`);
      }
    } else {
      log.info('ℹ No auto-fixable issues found - all errors require manual fixes');
    }
  }

  // Check for flag to just show file names
  if (shouldShowFiles()) {
    log.info('Files with linting issues:');
    results.forEach(result => {
      if (result.errorCount > 0 || result.warningCount > 0) {
        log.info(`  ${result.filePath} (${result.errorCount} errors, ${result.warningCount} warnings)`);
      }
    });
  } else {
    // Format and display results normally
    const formatter = await eslint.loadFormatter('stylish');
    const resultText = formatter.format(results);

    if (resultText) {
      log.info(resultText);
    }
  }

  // Calculate totals
  const errorCount = results.reduce((sum, result) => sum + result.errorCount, 0);
  const warningCount = results.reduce((sum, result) => sum + result.warningCount, 0);
  const fixableCount = results.reduce((sum, result) => sum + result.fixableErrorCount + result.fixableWarningCount, 0);

  // Handle errors
  if (errorCount > 0 && failOnErrors) {
    throw new Error(`${taskName} found ${errorCount} error(s) and ${warningCount} warning(s). Build halted due to failOnErrors setting.`);
  } else if (errorCount > 0) {
    log.info(`ℹ ${taskName} found ${errorCount} error(s) and ${warningCount} warning(s), but continuing build. Use --lint-errors-fail to halt on errors.`);
  }

  return { errorCount, warningCount, fixableCount };
}

const lintPhpTask = (done) => {
  if (shouldSkipLinting()) {
    return Promise.resolve()
  }

  let paths = [
    `${sake.config.paths.src}/**/*.php`,
    `!${sake.config.paths.vendor}/**/*.php`,
    `!**/node_modules/**/*.php`
  ]

  // skip composer paths
  if (sake.config.composer) {
    let installerPaths = dottie.get(sake.config.composer, 'extra.installer-paths')

    if (installerPaths) {
      Object.keys(installerPaths).forEach((vendorPath) => {
        paths.push(`!${vendorPath}/**/*.php`)
      })
    }
  }

  return gulp.src(paths)
    .pipe(phplint('', { skipPassedFiles: true, notify: false }))
    .pipe(phplint.reporter((file) => {
      let report = file.phplintReport || {}
      // make sure to fail on first error
      if (report.error) {
        sake.throwError(`${report.message} on line ${report.line} of ${report.filename}`)
      }
    }))
}
lintPhpTask.displayName = 'lint:php'

const lintCoffeeTask = (done) => {
  if (shouldSkipLinting()) {
    return Promise.resolve()
  }

  if (! fs.existsSync(sake.config.paths.assetPaths.js)) {
    return Promise.resolve()
  }

  let coffeeLintFile = sake.options['coffeelint-file'] ? path.join(process.cwd(), sake.options['coffeelint-file']) : path.join(__dirname, '../lib/lintfiles/coffeelint.json')

  return gulp.src(`${sake.config.paths.assetPaths.js}/**/*.coffee`)
    .pipe(coffeelint(coffeeLintFile))
    .pipe(coffeelint.reporter())
    .pipe(coffeelint.reporter('fail')) // fail task on errors
    .on('end', done)
    .on('error', done)
}
lintCoffeeTask.displayName = 'lint:coffee'

const lintJsTask = async () => {
  if (shouldSkipLinting()) {
    return Promise.resolve()
  }

  if (! fs.existsSync(sake.config.paths.assetPaths.js)) {
    return Promise.resolve()
  }

  // Check for flags
  const fixFlag = shouldFix()
  const failOnErrors = shouldFailOnLintErrors()

  await runESLint(sake.config.paths.assetPaths.javascriptSources, {
    fix: fixFlag,
    failOnErrors: failOnErrors,
    taskName: 'JavaScript linting'
  })
}
lintJsTask.displayName = 'lint:js'

const lintScssTask = (done) => {
  if (shouldSkipLinting()) {
    return Promise.resolve()
  }

  if (! fs.existsSync(sake.config.paths.assetPaths.css)) {
    return Promise.resolve()
  }

  let stylelintConfigFile = sake.config.tasks.lint.stylelintConfigFile ? path.join(process.cwd(), sake.config.tasks.lint.stylelintConfigFile) : path.join(__dirname, '../lib/lintfiles/.stylelintrc.json')

  const fixFlag = shouldFix()

  if (fixFlag) {
    log.info('Fixing lint errors...');
  }

  return gulp.src(`${sake.config.paths.assetPaths.css}/**/*.scss`)
    .pipe(postcss([
      stylelint({
        configFile: stylelintConfigFile,
        failAfterError: ! fixFlag,
        fix: fixFlag
      })
    ], { syntax: scssSyntax }))
    .pipe(gulpif(fixFlag, gulp.dest(sake.config.paths.assetPaths.css)))
    // explicitly setting end and error event handlers will give us cleaner error logging
    .on('end', done)
    .on('error', done)
}
lintScssTask.displayName = 'lint:scss'

// the main task to lint scripts
const lintScriptsTask = gulp.parallel(lintCoffeeTask, lintJsTask)
lintScriptsTask.displayName = 'lint:scripts'

// the main task to lint styles
const lintStylesTask = gulp.parallel(lintScssTask)
lintStylesTask.displayName = 'lint:styles'

const lintTask = gulp.parallel(lintPhpTask, lintScriptsTask, lintStylesTask)
lintTask.displayName = 'lint'

export {
  lintTask,
  lintScriptsTask,
  lintPhpTask,
  lintCoffeeTask,
  lintJsTask,
  lintScssTask,
  lintStylesTask,
  runESLint  // Export shared ESLint function
}
