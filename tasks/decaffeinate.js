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
const decaffeinateTask = async () => {
  log.info('Starting decaffeination process...')

  // First, get the list of CoffeeScript files to convert
  const { globby } = await import('globby')
  const coffeeFiles = await globby([`${sake.config.paths.assetPaths.js}/**/*.coffee`])

  if (coffeeFiles.length === 0) {
    log.info('No CoffeeScript files found to convert')
    return
  }

  log.info(`Found ${coffeeFiles.length} CoffeeScript file(s) to convert`)

  // Convert .coffee paths to .js paths for linting later
  const convertedJsFiles = coffeeFiles.map(file => file.replace(/\.coffee$/, '.js'))

  // Step 1: Compile CoffeeScript to JavaScript
  await new Promise((resolve, reject) => {
    gulp.src(coffeeFiles, { base: sake.config.paths.assetPaths.js })
      .pipe(coffee({ bare: true }))
      .pipe(gulp.dest(sake.config.paths.assetPaths.js))
      .on('end', resolve)
      .on('error', reject)
  })

  log.info('CoffeeScript compilation completed')

  // Step 2: Lint and fix only the converted JavaScript files
  try {
    log.info(`Step 2: Linting and fixing ${convertedJsFiles.length} converted JavaScript file(s)...`)
    const { runESLint } = await import('./lint.js')

    const results = await runESLint(convertedJsFiles, {
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

  } catch (error) {
    log.error('ESLint step failed:', error)
    throw error
  }
}
decaffeinateTask.displayName = 'decaffeinate'

export {
  decaffeinateTask
}
