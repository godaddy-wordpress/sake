import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { isNonInteractive, isDryRunDeploy, newPluginVersion } from '../../helpers/arguments.js'

// isNonInteractive/isDryRunDeploy/newPluginVersion are the three CLI-argument helpers added
// to support non-interactive (CI) deploys. The pre-existing helpers in this file (hasArg,
// shouldFix, shouldSkipLinting, shouldFailOnLintErrors, shouldShowFiles) are covered
// elsewhere - this file only covers the new ones.

let savedArgv

beforeEach(() => {
  savedArgv = process.argv
})

afterEach(() => {
  process.argv = savedArgv
})

test('isNonInteractive reflects whether --non-interactive is present', () => {
  process.argv = ['node', 'sake.js', '--non-interactive']
  assert.equal(isNonInteractive(), true)

  process.argv = ['node', 'sake.js']
  assert.equal(isNonInteractive(), false)
})

test('isDryRunDeploy reflects whether --dry-run is present', () => {
  process.argv = ['node', 'sake.js', '--dry-run']
  assert.equal(isDryRunDeploy(), true)

  process.argv = ['node', 'sake.js']
  assert.equal(isDryRunDeploy(), false)
})

test('newPluginVersion returns the value passed via --new-version', () => {
  process.argv = ['node', 'sake.js', '--new-version=1.2.3']
  assert.equal(newPluginVersion(), '1.2.3')
})

test('newPluginVersion returns null when --new-version is absent', () => {
  process.argv = ['node', 'sake.js']
  assert.equal(newPluginVersion(), null)
})

test('newPluginVersion does not confuse --new-version with unrelated flags', () => {
  process.argv = ['node', 'sake.js', '--non-interactive', '--dry-run']
  assert.equal(newPluginVersion(), null)
})
