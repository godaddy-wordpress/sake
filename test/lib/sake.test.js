import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import sake from '../../lib/sake.js'
import { enterFixturePlugin, exitFixturePlugin } from '../support/fixture-plugin.js'

before(() => {
  enterFixturePlugin()
  sake.initConfig()
})

after(() => {
  exitFixturePlugin()
})

// getVersionBump reads sake.options directly - reset between tests so one
// test's options don't leak into the next.
beforeEach(() => {
  delete sake.options.version_bump
  delete sake.options.version
  delete sake.options.version_custom
})

test('getPrereleaseVersions returns an empty array for a dash-free version', () => {
  // this is the shape sake.getPluginVersion() actually returns in practice
  // (tasks/deploy.js's only real call site), so this is the realistic case
  assert.deepEqual(sake.getPrereleaseVersions('1.0.0'), [])
})

test('getPrereleaseVersions returns an empty array for the realistic semver.inc prerelease format', () => {
  // semver.inc('1.0.0', 'prerelease') produces "1.0.1-0" - the last `.`-separated
  // segment ("1-0") isn't a clean number, so the loop's `i >= 1` check never
  // passes (NaN >= 1 is false) and the function silently returns nothing
  assert.deepEqual(sake.getPrereleaseVersions('1.0.1-0'), [])
})

test('getPrereleaseVersions produces dev/beta/RC/rc variants when the trailing segment is a clean number', () => {
  const versions = sake.getPrereleaseVersions('1.2.0-dev.3')

  assert.deepEqual(versions, [
    '1.2.0-dev.3', '1.2.0-beta.3', '1.2.0-RC.3', '1.2.0-rc.3',
    '1.2.0-dev.2', '1.2.0-beta.2', '1.2.0-RC.2', '1.2.0-rc.2',
    '1.2.0-dev.1', '1.2.0-beta.1', '1.2.0-RC.1', '1.2.0-rc.1'
  ])
})

test('getPluginName strips "WooCommerce " by default', () => {
  const original = sake.config.plugin.name
  sake.config.plugin.name = 'WooCommerce Something Plugin'

  assert.equal(sake.getPluginName(), 'Something Plugin')

  sake.config.plugin.name = original
})

test('getPluginName(false) keeps "WooCommerce " in the name', () => {
  const original = sake.config.plugin.name
  sake.config.plugin.name = 'WooCommerce Something Plugin'

  assert.equal(sake.getPluginName(false), 'WooCommerce Something Plugin')

  sake.config.plugin.name = original
})

test('normalizePath normalizes a messy relative path', () => {
  assert.equal(sake.normalizePath('a/b/../c'), 'a/c')
})

test('tailingSlashPath ensures a single trailing slash', () => {
  assert.equal(sake.tailingSlashPath('/foo/bar'), '/foo/bar/')
  assert.equal(sake.tailingSlashPath('/foo/bar/'), '/foo/bar/')
})

test('resolvePath resolves a relative path against cwd with a trailing slash', () => {
  const resolved = sake.resolvePath('./x')

  assert.equal(resolved.endsWith('/x/'), true)
  assert.equal(resolved.startsWith('/'), true)
})

test('resolvePath expands a leading ~/ to the home directory', () => {
  const resolved = sake.resolvePath('~/some-dir')
  const home = process.env.HOME || process.env.HOMEPATH || process.env.HOMEDIR

  assert.equal(resolved, sake.tailingSlashPath(`${home}/some-dir`))
})

test('getVersionBump prefers options.version_bump over options.version', () => {
  sake.options.version_bump = 'minor'
  sake.options.version = 'patch'

  assert.equal(sake.getVersionBump(), 'minor')
})

test('getVersionBump falls back to options.version when version_bump is unset', () => {
  sake.options.version = 'patch'

  assert.equal(sake.getVersionBump(), 'patch')
})

test('getVersionBump resolves "custom" to options.version_custom', () => {
  sake.options.version = 'custom'
  sake.options.version_custom = '9.9.9'

  assert.equal(sake.getVersionBump(), '9.9.9')
})

test('getDefaultIncrement always returns "patch"', () => {
  // config.plugin.changes.join('\n', '* Feature ') passes a second argument
  // to Array.join, which silently ignores it - the '* Feature ' needle never
  // actually reaches _str.include(), so this never returns 'minor' in practice
  const original = sake.config.plugin.changes
  sake.config.plugin.changes = ['* Feature - something new', '* Fix - a bug']

  assert.equal(sake.getDefaultIncrement(), 'patch')

  sake.config.plugin.changes = original
})

test('parseChangelog reads the fixture plugin changelog.txt correctly', () => {
  const changelog = sake.parseChangelog()

  assert.equal(changelog.plugin_name, 'Sake Test Fixture Plugin')
  assert.equal(changelog.plugin_version, '1.0.0')
  assert.equal(changelog.date, '2024.01.01')
  assert.deepEqual(changelog.changes, ["* Fix - Initial fixture release for sake's test suite"])
})

test('getMainPluginFile returns the basename by default', () => {
  assert.equal(sake.getMainPluginFile(), 'sake-test-fixture.php')
})

test('getMainPluginFile returns the full path when fullpath is true', () => {
  const fullPath = sake.getMainPluginFile(true)

  assert.equal(fullPath.endsWith('/sake-test-fixture.php'), true)
  assert.equal(fullPath.startsWith('/'), true)
})
