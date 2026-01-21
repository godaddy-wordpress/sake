import path from 'node:path'
import dottie from 'dottie'
import fs from 'node:fs'
import * as gulp from 'gulp'
import sake from '../lib/sake.js'
import phplint from 'gulp-phplint'
import coffeelint from 'gulp-coffeelint'
import { ESLint } from 'eslint'
import sassLint from 'gulp-sass-lint'
import { fileURLToPath } from 'node:url'
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
    (sake.options['eslint-configFile'] ?
      path.join(process.cwd(), sake.options['eslint-configFile']) :
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
    console.log(`No JavaScript files found to lint for ${taskName}`);
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
      console.log(`✓ Auto-fix applied to ${filesWithFixes.length} file(s)`);

      // Count remaining fixable issues (what couldn't be auto-fixed)
      const remainingFixableErrors = results.reduce((sum, result) => sum + result.fixableErrorCount, 0);
      const remainingFixableWarnings = results.reduce((sum, result) => sum + result.fixableWarningCount, 0);
      const remainingFixable = remainingFixableErrors + remainingFixableWarnings;

      if (remainingFixable > 0) {
        console.log(`ℹ ${remainingFixable} issue(s) could not be auto-fixed and require manual fixes`);
      }
    } else {
      console.log('ℹ No auto-fixable issues found - all errors require manual fixes');
    }
  }

  // Check for flag to just show file names
  if (process.argv.includes('--show-files')) {
    console.log('Files with linting issues:');
    results.forEach(result => {
      if (result.errorCount > 0 || result.warningCount > 0) {
        console.log(`  ${result.filePath} (${result.errorCount} errors, ${result.warningCount} warnings)`);
      }
    });
  } else {
    // Format and display results normally
    const formatter = await eslint.loadFormatter('stylish');
    const resultText = formatter.format(results);

    if (resultText) {
      console.log(resultText);
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
    console.log(`ℹ ${taskName} found ${errorCount} error(s) and ${warningCount} warning(s), but continuing build. Use --lint-errors-fail to halt on errors.`);
  }

  return { errorCount, warningCount, fixableCount };
}

const lintPhpTask = (done) => {
  if (process.argv.includes('--skip-linting')) {
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
  if (process.argv.includes('--skip-linting')) {
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
  if (process.argv.includes('--skip-linting')) {
    return Promise.resolve()
  }

  if (! fs.existsSync(sake.config.paths.assetPaths.js)) {
    return Promise.resolve()
  }

  // Check for flags
  const shouldFix = process.argv.includes('--fix')
  const shouldFailOnErrors = process.argv.includes('--lint-errors-fail')

  try {
    await runESLint(sake.config.paths.assetPaths.javascriptSources, {
      fix: shouldFix,
      failOnErrors: shouldFailOnErrors,
      taskName: 'JavaScript linting'
    })
  } catch (error) {
    throw error
  }
}
lintJsTask.displayName = 'lint:js'

const lintScssTask = (done) => {
  if (process.argv.includes('--skip-linting')) {
    return Promise.resolve()
  }

  if (! fs.existsSync(sake.config.paths.assetPaths.css)) {
    return Promise.resolve()
  }

  return gulp.src(`${sake.config.paths.assetPaths.css}/**/*.scss`)
    .pipe(sassLint())
    .pipe(sassLint.failOnError()) // fail task on errors
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
