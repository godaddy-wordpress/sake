import minimist from 'minimist'

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
 * Check if the --fail-on-lint-errors flag is present
 * @returns {boolean}
 */
const shouldFailOnLintErrors = () => {
  return hasArg('--fail-on-lint-errors')
}

/**
 * Check if the --show-files flag is present
 * @returns {boolean}
 */
const shouldShowFiles = () => {
  return hasArg('--show-files')
}

/**
 * Determines if the command is being run in "non-interactive mode". If true, we should never present with prompts.
 * @returns {boolean}
 */
const isNonInteractive = () => {
  return hasArg('--non-interactive')
}

/**
 * Whether this is a dry run deployment. If true, the deploy to WooCommerce will not actually happen.
 * @returns {boolean}
 */
const isDryRunDeploy = () => {
  return hasArg('--dry-run')
}

/**
 * The new version of the plugin to deploy. This can be provided via arguments instead of using the prompt.
 * This will likely be supplied when using non-interactive mode (e.g. CI/CD).
 * @returns {string|null} The version of the plugin to be deployed, if provided.
 */
const newPluginVersion = () => {
  const argv = minimist(process.argv.slice(2))

  return argv['new-version'] || null
}

export {
  hasArg,
  shouldFix,
  shouldSkipLinting,
  shouldFailOnLintErrors,
  shouldShowFiles,
  isNonInteractive,
  isDryRunDeploy,
  newPluginVersion
}
