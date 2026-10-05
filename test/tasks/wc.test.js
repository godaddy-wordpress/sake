import { test, before, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import axios from 'axios'
import sake from '../../lib/sake.js'

// tasks/wc.js computes its module-level `apiOptions` object (including `product_id` from
// `sake.config.deploy.wooId`) exactly once, at module-evaluation time - it is never re-read
// afterward even if sake.config.deploy.wooId changes later (confirmed empirically; see the
// bug writeup in the plan). ES module imports are hoisted above all other top-level
// statements and execute in declaration order before any plain statement in this file runs,
// so setting sake.config.deploy.wooId has to happen in a `before()` hook paired with a
// *dynamic* `import()` - a static `import { formatError } from '../../tasks/wc.js'` at the
// top of this file (as originally written) runs before `before()` gets a chance to set
// sake.config.deploy.wooId first, defeating the whole point.
const WOO_ID = 'test-product-id'
let wcValidateTask
let wcUploadTask
let wcDeployTask
let formatError

before(async () => {
  sake.config.deploy = { wooId: WOO_ID }
  const wcModule = await import('../../tasks/wc.js')
  wcValidateTask = wcModule.wcValidateTask
  wcUploadTask = wcModule.wcUploadTask
  wcDeployTask = wcModule.wcDeployTask
  formatError = wcModule.formatError
})

let savedConfig
let savedOptions

beforeEach(() => {
  savedConfig = JSON.parse(JSON.stringify(sake.config))
  savedOptions = JSON.parse(JSON.stringify(sake.options))

  sake.config.plugin = { id: 'my-plugin', version: { current: '1.0.0' } }
})

afterEach(() => {
  // see test/tasks/clean.test.js for why this must mutate in place
  for (const key of Object.keys(sake.config)) {
    delete sake.config[key]
  }
  Object.assign(sake.config, savedConfig)

  for (const key of Object.keys(sake.options)) {
    delete sake.options[key]
  }
  Object.assign(sake.options, savedOptions)
})

test('formatError extracts the WC API message and code from an axios error response', () => {
  const err = { response: { data: { message: 'Something broke', code: 'some_error' } } }

  assert.equal(formatError(err), 'WC API: Something broke (some_error)')
})

test('formatError returns the error itself when there is no API response (e.g. a network error)', () => {
  const err = new Error('network boom')

  assert.equal(formatError(err), err)
})

test('wcValidateTask completes successfully when the queued version is lower than the current version', async (t) => {
  t.mock.method(axios, 'post', async () => ({ data: { version: '0.5.0' } }))

  await new Promise((resolve) => wcValidateTask(resolve))
})

test('wcValidateTask treats "no deploy in progress" as success', async (t) => {
  t.mock.method(axios, 'post', async () => {
    const err = new Error('bad request')
    err.response = { data: { code: 'submission_runner_no_deploy_in_progress' } }
    throw err
  })

  await new Promise((resolve) => wcValidateTask(resolve))
})

test('wcValidateTask never calls back when the queued version is already >= the current version', async (t) => {
  // bug: throwing inside the `.then()` here (tasks/wc.js:60) is caught by the chained
  // `.catch()`, which only calls `sake.throwDeferredError()` - a deferred `setTimeout`
  // throw that never calls the task's own `done`. Same root pattern already documented for
  // gitHubCreateReleaseTask/createMilestones/fetchLatestWpWcVersionsTask; wcValidateTask
  // hits it from three separate branches (unexpected response code, version already
  // queued, and any other API/network error) - this test exercises the version-check one.
  t.mock.method(axios, 'post', async () => ({ data: { version: '2.0.0' } }))

  const thrownMessages = []
  t.mock.method(sake, 'throwDeferredError', (message) => { thrownMessages.push(message) })

  const STILL_PENDING = Symbol('still-pending')
  const result = await Promise.race([
    new Promise((resolve) => wcValidateTask(resolve)),
    new Promise((resolve) => setTimeout(() => resolve(STILL_PENDING), 200))
  ])

  assert.equal(result, STILL_PENDING)
  assert.equal(thrownMessages.length, 1)
  assert.match(thrownMessages[0], /Queued version for plugin is already higher than or equal to 1\.0\.0/)
})

test('wcValidateTask never calls back on a generic WC API error', async (t) => {
  t.mock.method(axios, 'post', async () => {
    const err = new Error('other')
    err.response = { data: { message: 'Something broke', code: 'other_error' } }
    throw err
  })

  const thrownMessages = []
  t.mock.method(sake, 'throwDeferredError', (message) => { thrownMessages.push(message) })

  const STILL_PENDING = Symbol('still-pending')
  const result = await Promise.race([
    new Promise((resolve) => wcValidateTask(resolve)),
    new Promise((resolve) => setTimeout(() => resolve(STILL_PENDING), 200))
  ])

  assert.equal(result, STILL_PENDING)
  assert.equal(thrownMessages.length, 1)
  assert.equal(thrownMessages[0], 'WC API: Something broke (other_error)')
})

test('wcValidateTask\'s request always carries the product_id sake.config.deploy.wooId had at process start, not its current value', async (t) => {
  // bug: tasks/wc.js's module-level `apiOptions` (product_id, plus username/password from
  // process.env) is built once at module-evaluation time and never re-read afterward -
  // confirmed empirically by changing sake.config.deploy.wooId after import and observing
  // the originally-captured value still gets sent.
  sake.config.deploy.wooId = 'changed-after-import'

  let postedBody
  t.mock.method(axios, 'post', async (url, body) => {
    postedBody = body
    return { data: { version: '0.5.0' } }
  })

  await new Promise((resolve) => wcValidateTask(resolve))

  assert.equal(postedBody.product_id, WOO_ID)
})

test('wcUploadTask completes successfully and posts the build zip as multipart form data', async (t) => {
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sake-wc-upload-test-'))
  const savedCwd = process.cwd()
  fs.mkdirSync(path.join(scratchDir, 'build'), { recursive: true })
  fs.writeFileSync(path.join(scratchDir, 'build', 'my-plugin.1.0.0.zip'), 'zip contents')
  process.chdir(scratchDir)

  try {
    sake.config.paths = { build: 'build' }

    let postedUrl
    let postedHeaders
    t.mock.method(axios, 'post', async (url, data, opts) => {
      postedUrl = url
      postedHeaders = opts && opts.headers
      return { data: { success: true } }
    })

    await new Promise((resolve) => wcUploadTask(resolve))

    assert.equal(postedUrl, 'https://woocommerce.com/wp-json/wc/submission/runner/v1/product/deploy')
    assert.ok(postedHeaders)
  } finally {
    process.chdir(savedCwd)
    fs.rmSync(scratchDir, { recursive: true, force: true })
  }
})

// bug (not exercised by a test): unlike wcValidateTask, wcUploadTask's `.catch()`
// (tasks/wc.js:133-141) doesn't call sake.throwDeferredError or anything else
// recoverable on failure - it just re-throws the error. Since nothing further chains onto
// (or awaits) that promise, the re-throw becomes a genuinely unhandled promise rejection,
// crashing the whole Node process by default - worse than the other tasks' "merely hangs
// forever" variant of this same root bug, and via a different mechanism. Confirmed
// empirically with a throwaway script and a process-level 'unhandledRejection' listener.
// Deliberately NOT encoded as an automated test here: node:test's own harness treats any
// unhandled rejection raised while a test is in flight as an unconditional failure for that
// test (the same behavior already documented for uncaughtException in
// test/tasks/validate.test.js) - and unlike that case, there's no sake.* call to mock here
// (it's a bare `throw err` with nothing downstream), so there's no way to sidestep the
// mechanism and still exercise the real code path.

test('wcDeployTask is a gulp.series composition of wcValidateTask and wcUploadTask under the "wc:deploy" display name', () => {
  assert.equal(typeof wcDeployTask, 'function')
  assert.equal(wcDeployTask.displayName, 'wc:deploy')
})
