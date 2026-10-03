import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sake from '../../lib/sake.js'
import { zipTask, buildAndZip } from '../../tasks/zip.js'

const awaitStream = (stream) => new Promise((resolve, reject) => {
  stream.on('end', resolve).on('error', reject)
})

let scratchDir
let savedCwd
let savedConfig
let savedOptions

beforeEach(() => {
  scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sake-zip-test-'))
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

test('zipTask creates a zip named after the plugin id and current version', async () => {
  sake.config.paths.build = 'build'
  sake.config.plugin = { id: 'my-plugin', version: { current: '1.0.0' } }

  const pluginDir = path.join(scratchDir, 'build', 'my-plugin')
  fs.mkdirSync(pluginDir, { recursive: true })
  fs.writeFileSync(path.join(pluginDir, 'my-plugin.php'), '<?php')

  await awaitStream(zipTask())

  assert.equal(fs.existsSync(path.join(scratchDir, 'build', 'my-plugin.1.0.0.zip')), true)
})

test('zipTask defaults its destination to the build path, resolved to an absolute trailing-slash path', async () => {
  sake.config.paths.build = 'build'
  sake.config.plugin = { id: 'my-plugin', version: { current: '1.0.0' } }

  const pluginDir = path.join(scratchDir, 'build', 'my-plugin')
  fs.mkdirSync(pluginDir, { recursive: true })
  fs.writeFileSync(path.join(pluginDir, 'my-plugin.php'), '<?php')

  await awaitStream(zipTask())

  assert.equal(sake.config.paths.zipDest, sake.resolvePath('build'))
})

test('zipTask honors a custom options.zipDest override', async () => {
  sake.config.paths.build = 'build'
  sake.config.plugin = { id: 'my-plugin', version: { current: '1.0.0' } }
  sake.options.zipDest = './custom-dest'

  const pluginDir = path.join(scratchDir, 'build', 'my-plugin')
  fs.mkdirSync(pluginDir, { recursive: true })
  fs.writeFileSync(path.join(pluginDir, 'my-plugin.php'), '<?php')

  await awaitStream(zipTask())

  assert.equal(fs.existsSync(path.join(scratchDir, 'custom-dest', 'my-plugin.1.0.0.zip')), true)
})

test('zipTask leaves a pre-existing zip in the build directory untouched', async () => {
  sake.config.paths.build = 'build'
  sake.config.plugin = { id: 'my-plugin', version: { current: '1.0.0' } }

  const pluginDir = path.join(scratchDir, 'build', 'my-plugin')
  fs.mkdirSync(pluginDir, { recursive: true })
  fs.writeFileSync(path.join(pluginDir, 'my-plugin.php'), '<?php')
  fs.writeFileSync(path.join(scratchDir, 'build', 'my-plugin.0.9.0.zip'), 'old zip contents')

  await awaitStream(zipTask())

  assert.equal(fs.readFileSync(path.join(scratchDir, 'build', 'my-plugin.0.9.0.zip'), 'utf8'), 'old zip contents')
  assert.equal(fs.existsSync(path.join(scratchDir, 'build', 'my-plugin.1.0.0.zip')), true)
})

test('buildAndZip is a gulp.series composition under the "zip" display name', () => {
  // gulp.series() returns a plain function with no inspectable metadata about
  // which tasks it wraps, and calling it would actually run the full build
  // pipeline - so this only checks what can be verified without invoking it.
  assert.equal(typeof buildAndZip, 'function')
  assert.equal(buildAndZip.displayName, 'zip')
})
