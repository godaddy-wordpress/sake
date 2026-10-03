import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  hasArg,
  shouldFix,
  shouldSkipLinting,
  shouldFailOnLintErrors,
  shouldShowFiles
} from '../../helpers/arguments.js'

let savedArgv

beforeEach(() => {
  savedArgv = process.argv
})

afterEach(() => {
  process.argv = savedArgv
})

test('hasArg returns true when the given flag is present in process.argv', () => {
  process.argv = ['node', 'sake.js', '--fix']

  assert.equal(hasArg('--fix'), true)
})

test('hasArg returns false when the given flag is absent from process.argv', () => {
  process.argv = ['node', 'sake.js']

  assert.equal(hasArg('--fix'), false)
})

test('shouldFix reflects whether --fix is present', () => {
  process.argv = ['node', 'sake.js', '--fix']
  assert.equal(shouldFix(), true)

  process.argv = ['node', 'sake.js']
  assert.equal(shouldFix(), false)
})

test('shouldSkipLinting reflects whether --skip-linting is present', () => {
  process.argv = ['node', 'sake.js', '--skip-linting']
  assert.equal(shouldSkipLinting(), true)

  process.argv = ['node', 'sake.js']
  assert.equal(shouldSkipLinting(), false)
})

test('shouldFailOnLintErrors reflects whether --fail-on-lint-errors is present', () => {
  process.argv = ['node', 'sake.js', '--fail-on-lint-errors']
  assert.equal(shouldFailOnLintErrors(), true)

  process.argv = ['node', 'sake.js']
  assert.equal(shouldFailOnLintErrors(), false)
})

test('shouldShowFiles reflects whether --show-files is present', () => {
  process.argv = ['node', 'sake.js', '--show-files']
  assert.equal(shouldShowFiles(), true)

  process.argv = ['node', 'sake.js']
  assert.equal(shouldShowFiles(), false)
})

test('unrelated flags do not trigger other checks (no false positives)', () => {
  process.argv = ['node', 'sake.js', '--fix']

  assert.equal(shouldSkipLinting(), false)
  assert.equal(shouldFailOnLintErrors(), false)
  assert.equal(shouldShowFiles(), false)
})
