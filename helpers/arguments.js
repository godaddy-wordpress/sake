export function isNonInteractive()
{
  return process.argv.includes('--non-interactive');
}
