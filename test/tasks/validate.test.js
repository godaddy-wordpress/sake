import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sake from '../../lib/sake.js'
import { validateReadmeHeadersTask } from '../../tasks/validate.js'

let scratchDir
let savedCwd
let savedConfig

beforeEach(() => {
  scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sake-validate-test-'))
  savedCwd = process.cwd()
  savedConfig = JSON.parse(JSON.stringify(sake.config))

  process.chdir(scratchDir)
})

afterEach(() => {
  process.chdir(savedCwd)

  // see test/tasks/clean.test.js for why this must mutate in place
  for (const key of Object.keys(sake.config)) {
    delete sake.config[key]
  }
  Object.assign(sake.config, savedConfig)

  fs.rmSync(scratchDir, { recursive: true, force: true })
})

// sake.throwError() does a synchronous `throw`, called from inside
// validateReadmeHeadersTask's fs.readFile callback. By the time that runs,
// the task function has already returned, so the throw surfaces as an
// uncaughtException rather than something a caller can catch normally - and
// node:test's own test harness treats any uncaughtException raised while a
// test is in flight as an unconditional failure for that test, with no way
// to mark it as an expected/passing outcome. Mocking throwError to record
// the message instead of actually throwing sidesteps that entirely, and is
// arguably a better test of "was the right header reported missing" anyway.
const runValidateTask = (t) => new Promise((resolve) => {
  const messages = []
  t.mock.method(sake, 'throwError', (message) => {
    messages.push(message)
  })

  validateReadmeHeadersTask(() => resolve(messages))
})

test('passes when License and License URI are both present (non-wp deploy)', async (t) => {
  sake.config.paths.src = '.'
  sake.config.deploy = { type: 'wc' }
  fs.writeFileSync(path.join(scratchDir, 'readme.txt'), '=== Test Plugin ===\nLicense: GPLv3\nLicense URI: https://www.gnu.org/licenses/gpl-3.0.html\n')

  const messages = await runValidateTask(t)

  assert.deepEqual(messages, [])
})

test('reports a missing License header', async (t) => {
  sake.config.paths.src = '.'
  sake.config.deploy = { type: 'wc' }
  fs.writeFileSync(path.join(scratchDir, 'readme.txt'), '=== Test Plugin ===\nLicense URI: https://www.gnu.org/licenses/gpl-3.0.html\n')

  const messages = await runValidateTask(t)

  assert.equal(messages.length, 1)
  assert.match(messages[0], /Missing required header in readme\.txt: License(?!\s*URI)/)
})

test('reports a missing License URI header', async (t) => {
  sake.config.paths.src = '.'
  sake.config.deploy = { type: 'wc' }
  fs.writeFileSync(path.join(scratchDir, 'readme.txt'), '=== Test Plugin ===\nLicense: GPLv3\n')

  const messages = await runValidateTask(t)

  assert.equal(messages.length, 1)
  assert.match(messages[0], /Missing required header in readme\.txt: License URI/)
})

test('also requires Stable tag when deploy type is wp', async (t) => {
  sake.config.paths.src = '.'
  sake.config.deploy = { type: 'wp' }
  fs.writeFileSync(path.join(scratchDir, 'readme.txt'), '=== Test Plugin ===\nLicense: GPLv3\nLicense URI: https://www.gnu.org/licenses/gpl-3.0.html\n')

  const messages = await runValidateTask(t)

  assert.equal(messages.length, 1)
  assert.match(messages[0], /Missing required header in readme\.txt: Stable tag/)
})

test('passes for wp deploy type when Stable tag is also present', async (t) => {
  sake.config.paths.src = '.'
  sake.config.deploy = { type: 'wp' }
  fs.writeFileSync(path.join(scratchDir, 'readme.txt'), '=== Test Plugin ===\nLicense: GPLv3\nLicense URI: https://www.gnu.org/licenses/gpl-3.0.html\nStable tag: 1.0.0\n')

  const messages = await runValidateTask(t)

  assert.deepEqual(messages, [])
})
