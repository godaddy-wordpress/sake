import { test } from 'node:test'
import assert from 'node:assert/strict'
import semver from 'semver'
import { filterIncrement, getDefault } from '../../tasks/prompt.js'
import sake from '../../lib/sake.js'

test('filterIncrement returns "custom" when the increment is custom', () => {
  assert.equal(filterIncrement(['1.2.3', 'custom']), 'custom')
})

test('filterIncrement returns "skip" when the increment is skip', () => {
  assert.equal(filterIncrement(['1.2.3', 'skip']), 'skip')
})

test('filterIncrement delegates to semver.inc for standard increments', () => {
  assert.equal(filterIncrement(['1.2.3', 'patch']), semver.inc('1.2.3', 'patch'))
  assert.equal(filterIncrement(['1.2.3', 'minor']), semver.inc('1.2.3', 'minor'))
  assert.equal(filterIncrement(['1.2.3', 'major']), semver.inc('1.2.3', 'major'))
  assert.equal(filterIncrement(['1.2.3', 'prerelease']), semver.inc('1.2.3', 'prerelease'))
})

test('getDefault returns 1 when sake.getDefaultIncrement() is "patch"', (t) => {
  t.mock.method(sake, 'getDefaultIncrement', () => 'patch')

  assert.equal(getDefault(), 1)
})

test('getDefault returns 2 when sake.getDefaultIncrement() is "minor"', (t) => {
  t.mock.method(sake, 'getDefaultIncrement', () => 'minor')

  assert.equal(getDefault(), 2)
})

test('getDefault returns 3 when sake.getDefaultIncrement() is "major"', (t) => {
  t.mock.method(sake, 'getDefaultIncrement', () => 'major')

  assert.equal(getDefault(), 3)
})
