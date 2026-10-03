import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import sake from '../../lib/sake.js'
import { configTask } from '../../tasks/config.js'

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

test('logs the full sake config when no --property option is given', (t, done) => {
  delete sake.options.property
  sake.config.deploy = { type: 'wc' }

  const calls = []
  t.mock.method(console, 'log', (...args) => { calls.push(args) })

  configTask(() => {
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], sake.config)
    done()
  })
})

test('logs only the requested property when --property is given', (t, done) => {
  sake.config.deploy = { type: 'wc', production: { name: 'my-repo' } }
  sake.options.property = 'deploy.production'

  const calls = []
  t.mock.method(console, 'log', (...args) => { calls.push(args) })

  configTask(() => {
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0][0], { name: 'my-repo' })
    done()
  })
})

test('logs undefined when --property does not match any config value', (t, done) => {
  sake.options.property = 'does.not.exist'

  const calls = []
  t.mock.method(console, 'log', (...args) => { calls.push(args) })

  configTask(() => {
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], undefined)
    done()
  })
})
