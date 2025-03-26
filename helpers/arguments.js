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

/**
 * Whether this is a dry run deployment. If true, the deploy will not actually happen.
 * @returns {boolean}
 */
export function isDryRunDeploy()
{
  return process.argv.includes('--dry-run');
}

/**
 * If specified, then no changes will be made/committed to the code base during a deployment. This should be used if
 * you're specifying an _exact_ release to deploy, rather than having Sake create the release for you. The expectation
 * here is that prior to deployment the code has already had all the versions/min-reqs bumped.
 * @returns {boolean}
 */
export function withoutCodeChanges()
{
  return process.argv.includes('--without-code-changes');
}
