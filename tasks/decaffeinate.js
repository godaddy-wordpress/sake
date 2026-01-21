import path from 'node:path';
import sake from '../lib/sake.js'
import gulp from 'gulp'
import browserSync from 'browser-sync'
import coffee from 'gulp-coffee'
import gulpif from 'gulp-if'
import { ESLint } from 'eslint'
import { fileURLToPath } from 'node:url'
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Converts CoffeeScripts to ES6 JavaScript without minification or further handling.
 * This command should only be run once when converting an existing plugin CoffeeScript codebase to plain ES6.
 */
const decaffeinateTask = async () => {
  // Step 1: Compile CoffeeScript to JavaScript
  await new Promise((resolve, reject) => {
    gulp.src(`${sake.config.paths.assetPaths.js}/**/*.coffee`)
      .pipe(coffee({ bare: true }))
      .pipe(gulp.dest(sake.config.paths.assetPaths.js))
      .pipe(gulpif(() => sake.isWatching && sake.config.tasks.watch.useBrowserSync, browserSync.stream.apply({ match: '**/*.js' })))
      .on('end', resolve)
      .on('error', reject)
  })

  // Step 2: Lint and fix the generated JavaScript files
  try {
    // Import the shared ESLint function from lint.js
    const { runESLint } = await import('./lint.js')

    const results = await runESLint(`${sake.config.paths.assetPaths.js}/**/*.js`, {
      fix: true,  // Always fix during decaffeination
      failOnErrors: false,
      taskName: 'Decaffeination linting'
    })

    // Provide friendly completion message
    if (results.errorCount === 0) {
      if (results.warningCount > 0) {
        console.log(`✓ Decaffeination completed successfully with ${results.warningCount} warning(s).`)
      } else {
        console.log('✓ Decaffeination completed successfully with no linting issues.')
      }
    }

  } catch (error) {
    // Re-throw with more specific decaffeination context
    if (error.message.includes('ESLint found')) {
      throw new Error(`Decaffeination completed but ${error.message.replace('Decaffeination linting found', 'ESLint found')} that could not be auto-fixed.`)
    }
    throw error
  }
}
decaffeinateTask.displayName = 'decaffeinate'

export {
  decaffeinateTask
}
