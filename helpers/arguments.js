import minimist from 'minimist'

/**
 * Determines if the command is being run in "non-interactive mode". If true, we should never present with prompts.
 * @returns {boolean}
 */
export function isNonInteractive()
{
  return process.argv.includes('--non-interactive');
}

/**
 * Whether this is a dry run deployment. If true, the deploy to WooCommerce will not actually happen.
 * @returns {boolean}
 */
export function isDryRunDeploy()
{
  return process.argv.includes('--dry-run');
}

/**
 * The new version of the plugin to deploy. This can be provided via arguments instead of using the prompt.
 * This will likely be supplied when using non-interactive mode (e.g. CI/CD).
 * @returns {string|null} The version of the plugin to be deployed, if provided.
 */
export const newPluginVersion = () => {
    const argv = minimist(process.argv.slice(2))
  
    return argv['new-version'] || null;
  }
