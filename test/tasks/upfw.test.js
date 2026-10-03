import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import shell from 'shelljs'
import sake from '../../lib/sake.js'
import { setFrameworkVersionTask, updateFrameworkTask } from '../../tasks/upfw.js'

let scratchDir
let savedCwd
let savedConfig
let savedOptions

beforeEach(() => {
  scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sake-upfw-test-'))
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

test('setFrameworkVersionTask records the installed framework version onto sake.config.plugin', async (t) => {
  sake.config.plugin = { frameworkVersion: null }
  t.mock.method(sake, 'getFrameworkVersion', () => '5.14.0')

  await new Promise((resolve) => setFrameworkVersionTask(resolve))

  assert.equal(sake.config.plugin.frameworkVersion, '5.14.0')
})

test('updateFrameworkTask throws when no framework version is specified and composer updates are not skipped', () => {
  sake.config.framework = 'v4'
  sake.config.plugin = { mainFile: 'main-plugin.php', frameworkVersion: '5.10.0' }
  sake.config.composer = { require: { 'skyverge/wc-plugin-framework': '5.10.0' } }
  delete sake.options.framework_version

  assert.throws(() => updateFrameworkTask(() => {}), /Framework version not specified/)
})

test('updateFrameworkTask updates composer.json and runs a composer update', async (t) => {
  fs.writeFileSync('composer.json', JSON.stringify({ require: { 'skyverge/wc-plugin-framework': '5.10.0' }, 'require-dev': {} }))
  fs.writeFileSync('main-plugin.php', "<?php\nFRAMEWORK_VERSION = '5.10.0';\n")
  fs.writeFileSync('readme.txt', '=== Test Plugin ===\n')

  sake.config.framework = 'v4'
  sake.config.paths.src = '.'
  sake.config.paths.framework = { base: 'vendor/skyverge/wc-plugin-framework' }
  sake.config.plugin = { mainFile: 'main-plugin.php', name: 'My Plugin', frameworkVersion: '5.10.0' }
  sake.config.composer = JSON.parse(fs.readFileSync('composer.json', 'utf8'))
  sake.options.framework_version = '5.14.0'

  const calls = []
  t.mock.method(shell, 'exec', (command, optsOrCallback, maybeCallback) => {
    calls.push(command)
    const callback = typeof optsOrCallback === 'function' ? optsOrCallback : maybeCallback
    if (callback) callback(0, '', '')
    return { code: 0 }
  })

  await new Promise((resolve, reject) => updateFrameworkTask((err) => (err ? reject(err) : resolve())))

  assert.deepEqual(JSON.parse(fs.readFileSync('composer.json', 'utf8')), {
    require: { 'skyverge/wc-plugin-framework': '5.14.0' },
    'require-dev': {}
  })
  assert.ok(calls.includes('composer update --no-dev'))
})

test('updateFrameworkTask skips the composer update and uses the already-installed framework version when --skip-composer-update is passed', async (t) => {
  fs.writeFileSync('composer.json', JSON.stringify({ require: { 'skyverge/wc-plugin-framework': '5.10.0' } }))
  fs.writeFileSync('main-plugin.php', "<?php\nFRAMEWORK_VERSION = '5.10.0';\n")
  fs.writeFileSync('readme.txt', '=== Test Plugin ===\n')

  sake.config.framework = 'v4'
  sake.config.paths.src = '.'
  sake.config.paths.framework = { base: 'vendor/skyverge/wc-plugin-framework' }
  sake.config.plugin = { mainFile: 'main-plugin.php', name: 'My Plugin', frameworkVersion: '5.10.0' }
  sake.config.composer = JSON.parse(fs.readFileSync('composer.json', 'utf8'))
  sake.options['skip-composer-update'] = true

  const composerJsonBefore = fs.readFileSync('composer.json', 'utf8')

  const calls = []
  t.mock.method(shell, 'exec', (command, optsOrCallback, maybeCallback) => {
    calls.push(command)
    const callback = typeof optsOrCallback === 'function' ? optsOrCallback : maybeCallback
    if (callback) callback(0, '', '')
    return { code: 0 }
  })

  await new Promise((resolve, reject) => updateFrameworkTask((err) => (err ? reject(err) : resolve())))

  assert.equal(fs.readFileSync('composer.json', 'utf8'), composerJsonBefore)
  assert.equal(calls.includes('composer update --no-dev'), false)
  assert.equal(sake.options.framework_version, '5.10.0')
})
