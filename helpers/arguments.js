/**
 * Helper functions for checking command line arguments
 */

/**
 * Check if a specific argument is present in process.argv
 * @param {string} arg - The argument to check for (including dashes, e.g., '--fix')
 * @returns {boolean}
 */
const hasArg = (arg) => {
  return process.argv.includes(arg)
}

/**
 * Check if the --fix flag is present
 * @returns {boolean}
 */
const shouldFix = () => {
  return hasArg('--fix')
}

/**
 * Check if the --skip-linting flag is present
 * @returns {boolean}
 */
const shouldSkipLinting = () => {
  return hasArg('--skip-linting')
}

/**
 * Check if the --lint-errors-fail flag is present
 * @returns {boolean}
 */
const shouldFailOnLintErrors = () => {
  return hasArg('--lint-errors-fail')
}

/**
 * Check if the --show-files flag is present
 * @returns {boolean}
 */
const shouldShowFiles = () => {
  return hasArg('--show-files')
}

export {
  hasArg,
  shouldFix,
  shouldSkipLinting,
  shouldFailOnLintErrors,
  shouldShowFiles
}