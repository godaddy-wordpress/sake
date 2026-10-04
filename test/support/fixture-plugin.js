import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Absolute path to the fixture plugin directory used by sake's own test suite.
 */
export const fixturePluginPath = path.join(__dirname, '..', 'fixtures', 'plugin')

let savedCwd
let savedDeployDev

/**
 * Changes the process cwd to the fixture plugin directory and sets DEPLOY_DEV
 * so that `sake.initConfig()` can run against it without crashing (the fixture
 * has no .git directory, so sake can't otherwise infer a dev repo slug).
 *
 * Call `exitFixturePlugin()` in an `after`/`afterEach` to restore state.
 */
export function enterFixturePlugin () {
  savedCwd = process.cwd()
  savedDeployDev = process.env.DEPLOY_DEV

  process.chdir(fixturePluginPath)
  process.env.DEPLOY_DEV = 'skyverge/sake-test-fixture'
}

/**
 * Restores the cwd and DEPLOY_DEV env var saved by `enterFixturePlugin()`.
 */
export function exitFixturePlugin () {
  process.chdir(savedCwd)

  if (savedDeployDev === undefined) {
    delete process.env.DEPLOY_DEV
  } else {
    process.env.DEPLOY_DEV = savedDeployDev
  }
}
