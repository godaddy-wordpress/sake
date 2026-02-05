import path from 'node:path';
import sake from '../lib/sake.js'
import gulp from 'gulp'
import browserSync from 'browser-sync'
import coffee from 'gulp-coffee'
import gulpif from 'gulp-if'
import log from 'fancy-log'
import { ESLint } from 'eslint'
import { fileURLToPath } from 'node:url'
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Converts CoffeeScripts to ES6 JavaScript without minification or further handling.
 * This command should only be run once when converting an existing plugin CoffeeScript codebase to plain ES6.
 */
const decaffeinateTask = (done) => {
  log.info('Starting decaffeination process...')

  // Step 1: Compile CoffeeScript to JavaScript
  return gulp.src(`${sake.config.paths.assetPaths.js}/**/*.coffee`)
    .pipe(coffee({ bare: true }))
    .pipe(gulp.dest(sake.config.paths.assetPaths.js))
    .pipe(gulpif(() => sake.isWatching && sake.config.tasks.watch.useBrowserSync, browserSync.stream.apply({ match: '**/*.js' })))
    .on('end', async () => {
      log.info('CoffeeScript compilation completed')

      // Step 2: Lint and fix the generated JavaScript files
      try {
        log.info('Step 2: Linting and fixing generated JavaScript...')
        const { runESLint } = await import('./lint.js')

        const results = await runESLint(`${sake.config.paths.assetPaths.js}/**/*.js`, {
          fix: true,
          failOnErrors: false,
          taskName: 'Decaffeination linting'
        })

        // Provide friendly completion message
        if (results.errorCount === 0) {
          if (results.warningCount > 0) {
            log.info(`✓ Decaffeination completed successfully with ${results.warningCount} warning(s).`)
          } else {
            log.info('✓ Decaffeination completed successfully with no linting issues.')
          }
        }

        log.info('Decaffeination process completed successfully!')
        done()  // Signal completion

      } catch (error) {
        log.error('ESLint step failed:', error)
        done(error)  // Signal error
      }
    })
    .on('error', done)  // Pass any stream errors to done callback
}
decaffeinateTask.displayName = 'decaffeinate'

export {
  decaffeinateTask
}
