import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import axios from 'axios'
import sake from '../../lib/sake.js'
import { fetchLatestWpWcVersionsTask } from '../../tasks/deploy.js'

let savedConfig
let savedOptions

beforeEach(() => {
  savedConfig = JSON.parse(JSON.stringify(sake.config))
  savedOptions = JSON.parse(JSON.stringify(sake.options))
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

test('fetchLatestWpWcVersionsTask fetches and records both the latest WP and WC versions', async (t) => {
  sake.config.platform = 'wc'

  const requestedUrls = []
  t.mock.method(axios, 'get', async (url) => {
    requestedUrls.push(url)

    if (url.includes('version-check')) {
      return { data: { offers: [{ version: '6.5' }] } }
    }

    return { data: { version: '8.9' } }
  })

  await new Promise((resolve) => fetchLatestWpWcVersionsTask(resolve))

  assert.equal(sake.options.tested_up_to_wp_version, '6.5')
  assert.equal(sake.options.tested_up_to_wc_version, '8.9')
  assert.equal(requestedUrls.length, 2)
  assert.match(requestedUrls[0], /version-check/)
  assert.match(requestedUrls[1], /woocommerce\.json/)
})

test('fetchLatestWpWcVersionsTask skips the WC request when platform is not "wc"', async (t) => {
  sake.config.platform = 'edd'

  const requestedUrls = []
  t.mock.method(axios, 'get', async (url) => {
    requestedUrls.push(url)
    return { data: { offers: [{ version: '6.5' }] } }
  })

  await new Promise((resolve) => fetchLatestWpWcVersionsTask(resolve))

  assert.equal(sake.options.tested_up_to_wp_version, '6.5')
  assert.equal(sake.options.tested_up_to_wc_version, undefined)
  assert.deepEqual(requestedUrls, ['https://api.wordpress.org/core/version-check/1.7/'])
})

test('fetchLatestWpWcVersionsTask skips both requests when both versions are already set', async (t) => {
  sake.config.platform = 'wc'
  sake.options.tested_up_to_wp_version = '6.0'
  sake.options.tested_up_to_wc_version = '8.0'

  let callCount = 0
  t.mock.method(axios, 'get', async () => { callCount++; return { data: {} } })

  await new Promise((resolve) => fetchLatestWpWcVersionsTask(resolve))

  assert.equal(callCount, 0)
})

test('fetchLatestWpWcVersionsTask never calls back when a request fails', async (t) => {
  // bug: on failure, axios.all's `.catch()` (tasks/deploy.js:446) only calls
  // `sake.throwDeferredError()` - a `setTimeout`-deferred throw, so the error surfaces as
  // an uncaught exception on the next tick rather than through any catchable path - it
  // never calls the task's own `done` callback. In real (non-mocked) usage this crashes the
  // whole process shortly after this task "completes" (the deferred throw is uncaught), but
  // either way the task itself never signals completion. Confirmed here with
  // throwDeferredError mocked, to observe the "never calls back" half of the bug without
  // actually crashing the test process.
  sake.config.platform = 'wc'

  t.mock.method(axios, 'get', async () => { throw new Error('network boom') })

  const thrownMessages = []
  t.mock.method(sake, 'throwDeferredError', (message) => { thrownMessages.push(message) })

  const STILL_PENDING = Symbol('still-pending')
  const result = await Promise.race([
    new Promise((resolve) => fetchLatestWpWcVersionsTask(resolve)),
    new Promise((resolve) => setTimeout(() => resolve(STILL_PENDING), 200))
  ])

  assert.equal(result, STILL_PENDING)
  assert.equal(thrownMessages.length, 1)
  assert.match(thrownMessages[0], /An error occurred when fetching latest WP \/ WC versions: Error: network boom/)
})
