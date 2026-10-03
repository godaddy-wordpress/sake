import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import semver from 'semver'
import inquirer from 'inquirer'
import axios from 'axios'
import { filterIncrement, getDefault, promptDeployTask, promptWcUploadTask, promptTestedReleaseZipTask } from '../../tasks/prompt.js'
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

// promptDeployTask/promptWcUploadTask/promptTestedReleaseZipTask mock inquirer.prompt to
// run non-interactively - this bypasses inquirer's own `filter`/`default`/`validate`
// option handling entirely (already covered independently above via filterIncrement/
// getDefault), so these only verify that each task wires the mocked answer through
// correctly.
let scratchDir
let savedCwd
let savedConfig
let savedOptions

beforeEach(() => {
  scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sake-prompt-test-'))
  savedCwd = process.cwd()
  savedConfig = JSON.parse(JSON.stringify(sake.config))
  savedOptions = JSON.parse(JSON.stringify(sake.options))

  process.chdir(scratchDir)
})

afterEach(() => {
  process.chdir(savedCwd)

  // see test/tasks/clean.test.js for why this must mutate in place
  for (const key of Object.keys(sake.config)) {
    delete sake.config[key]
  }
  Object.assign(sake.config, savedConfig)

  for (const key of Object.keys(sake.options)) {
    delete sake.options[key]
  }
  Object.assign(sake.options, savedOptions)

  fs.rmSync(scratchDir, { recursive: true, force: true })
})

test('promptDeployTask merges the selected version answer into sake.options', async (t) => {
  sake.config.plugin = {
    name: 'My Plugin',
    changes: ['* Fix - something'],
    version: { current: '1.0.0', prerelease: '1.0.1-0', patch: '1.0.1', minor: '1.1.0', major: '2.0.0' }
  }

  let capturedQuestions
  t.mock.method(inquirer, 'prompt', async (questions) => {
    capturedQuestions = questions
    return { version: 'patch' }
  })

  await new Promise((resolve) => promptDeployTask(resolve))

  assert.equal(sake.options.version, 'patch')
  // uses getDefault()'s "patch" mapping (see above) since no sake.getDefaultIncrement mock is set
  assert.equal(capturedQuestions[0].default, 1)
})

test('promptWcUploadTask skips the WC upload and logs when declined', async (t) => {
  t.mock.method(inquirer, 'prompt', async () => ({ upload_to_wc: false }))
  t.mock.method(axios, 'post', async () => { throw new Error('axios.post should not have been called') })

  await new Promise((resolve) => promptWcUploadTask(resolve))
})

test('promptWcUploadTask runs the WC deploy series when confirmed', async (t) => {
  fs.mkdirSync('build', { recursive: true })
  fs.writeFileSync(path.join('build', 'my-plugin.1.0.0.zip'), 'zip contents')

  sake.config.plugin = { id: 'my-plugin', version: { current: '1.0.0' } }
  sake.config.paths = { build: 'build' }

  t.mock.method(inquirer, 'prompt', async () => ({ upload_to_wc: true }))

  let postCount = 0
  t.mock.method(axios, 'post', async (url) => {
    postCount++
    return url.includes('deploy/status') ? { data: { version: '0.1.0' } } : { data: { success: true } }
  })

  await new Promise((resolve) => promptWcUploadTask(resolve))

  assert.equal(postCount, 2)
})

test('promptTestedReleaseZipTask completes when the release zip has been tested', async (t) => {
  t.mock.method(inquirer, 'prompt', async () => ({ tested_release_zip: true }))

  await new Promise((resolve) => promptTestedReleaseZipTask(resolve))
})

test('promptTestedReleaseZipTask reports via throwError and never calls back when the release zip has not been tested', async (t) => {
  // bug: like promptWcUploadTask's own underlying wcUploadTask (and the other "error
  // branch never calls back" cases documented elsewhere), the `else` branch here
  // (tasks/prompt.js:132) only calls `sake.throwError(...)` - which throws synchronously
  // in real usage, turning into an unhandled promise rejection since nothing follows this
  // `.then()` in the chain (confirmed empirically outside this test) - and never reaches a
  // `done()` call either way. Mocking throwError to record instead of throw (to observe
  // the message without crashing the test process) still leaves no `done()` call in this
  // branch, so the race-with-timeout technique applies here too.
  t.mock.method(inquirer, 'prompt', async () => ({ tested_release_zip: false }))

  const thrownMessages = []
  t.mock.method(sake, 'throwError', (message) => { thrownMessages.push(message) })

  const STILL_PENDING = Symbol('still-pending')
  const result = await Promise.race([
    new Promise((resolve) => promptTestedReleaseZipTask(resolve)),
    new Promise((resolve) => setTimeout(() => resolve(STILL_PENDING), 200))
  ])

  assert.equal(result, STILL_PENDING)
  assert.deepEqual(thrownMessages, ['Run npx sake zip to generate a zip of this release and test it on a WordPress installation.'])
})
