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
 * Whether we already have a GitHub release for this deployment. If we don't, we'll be creating one.
 * @returns {boolean}
 */
export function hasGitRelease()
{
  const argv = minimist(process.argv.slice(2))
  const releaseUrl = argv.release || null;

  return !! releaseUrl;
}
