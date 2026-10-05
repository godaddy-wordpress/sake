import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sake from '../../lib/sake.js'
import {
  cleanDevTask,
  cleanComposerTask,
  cleanBuildTask,
  cleanWcRepoTask,
  cleanPrereleaseTask,
  cleanWpTrunkTask,
  cleanWpAssetsTask
} from '../../tasks/clean.js'

let scratchDir
let savedCwd
let savedConfig
let savedEnv

beforeEach(() => {
  scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sake-clean-test-'))
  savedCwd = process.cwd()
  savedConfig = JSON.parse(JSON.stringify(sake.config))
  savedEnv = process.env.SAKE_PRE_RELEASE_PATH

  process.chdir(scratchDir)
})

afterEach(() => {
  process.chdir(savedCwd)

  // sake.config must be mutated in place, not reassigned: every exported
  // method closes over the original config object directly, not the
  // sake.config property, so `sake.config = X` would silently decouple
  // them from X.
  for (const key of Object.keys(sake.config)) {
    delete sake.config[key]
  }
  Object.assign(sake.config, savedConfig)

  if (savedEnv === undefined) {
    delete process.env.SAKE_PRE_RELEASE_PATH
  } else {
    process.env.SAKE_PRE_RELEASE_PATH = savedEnv
  }

  fs.rmSync(scratchDir, { recursive: true, force: true })
})

test('cleanDevTask removes .map files under the assets path', async () => {
  const mapDir = path.join(scratchDir, sake.config.paths.src, sake.config.paths.assets, 'js')
  fs.mkdirSync(mapDir, { recursive: true })
  fs.writeFileSync(path.join(mapDir, 'app.js.map'), '')
  fs.writeFileSync(path.join(mapDir, 'app.js'), '')

  await cleanDevTask()

  assert.equal(fs.existsSync(path.join(mapDir, 'app.js.map')), false)
  assert.equal(fs.existsSync(path.join(mapDir, 'app.js')), true)
})

test('cleanComposerTask removes the configured vendor directory', async () => {
  sake.config.paths.vendor = 'vendor'
  fs.mkdirSync(path.join(scratchDir, 'vendor', 'some-package'), { recursive: true })

  await cleanComposerTask()

  assert.equal(fs.existsSync(path.join(scratchDir, 'vendor')), false)
})

test('cleanBuildTask removes the plugin build directory and its release zips', async () => {
  sake.config.plugin = { id: 'my-plugin' }
  fs.mkdirSync(path.join(scratchDir, 'build', 'my-plugin'), { recursive: true })
  fs.writeFileSync(path.join(scratchDir, 'build', 'my-plugin.1.0.0.zip'), '')
  fs.writeFileSync(path.join(scratchDir, 'build', 'unrelated-plugin.zip'), '')

  await cleanBuildTask()

  assert.equal(fs.existsSync(path.join(scratchDir, 'build', 'my-plugin')), false)
  assert.equal(fs.existsSync(path.join(scratchDir, 'build', 'my-plugin.1.0.0.zip')), false)
  assert.equal(fs.existsSync(path.join(scratchDir, 'build', 'unrelated-plugin.zip')), true)
})

test('cleanWcRepoTask removes everything inside the production repo path, but not the directory itself', async () => {
  sake.config.paths.tmp = scratchDir
  sake.config.deploy = { production: { name: 'wc-repo' } }
  const repoPath = path.join(scratchDir, 'wc-repo')
  fs.mkdirSync(path.join(repoPath, 'subdir'), { recursive: true })
  fs.writeFileSync(path.join(repoPath, 'file.txt'), '')
  fs.writeFileSync(path.join(repoPath, 'subdir', 'nested.txt'), '')

  await cleanWcRepoTask()

  assert.equal(fs.existsSync(repoPath), true)
  assert.equal(fs.existsSync(path.join(repoPath, 'file.txt')), false)
  assert.equal(fs.existsSync(path.join(repoPath, 'subdir')), false)
})

test('cleanPrereleaseTask removes the plugin\'s prerelease zip and txt files', async () => {
  process.env.SAKE_PRE_RELEASE_PATH = scratchDir
  sake.config.plugin = { id: 'my-plugin' }
  fs.writeFileSync(path.join(scratchDir, 'my-plugin-1.0.0-rc.1.zip'), '')
  fs.writeFileSync(path.join(scratchDir, 'my-plugin-1.0.0-rc.1.txt'), '')
  fs.writeFileSync(path.join(scratchDir, 'unrelated-plugin.zip'), '')

  await cleanPrereleaseTask()

  assert.equal(fs.existsSync(path.join(scratchDir, 'my-plugin-1.0.0-rc.1.zip')), false)
  assert.equal(fs.existsSync(path.join(scratchDir, 'my-plugin-1.0.0-rc.1.txt')), false)
  assert.equal(fs.existsSync(path.join(scratchDir, 'unrelated-plugin.zip')), true)
})

test('cleanWpTrunkTask removes the production repo\'s trunk directory', async () => {
  sake.config.paths.tmp = scratchDir
  sake.config.deploy = { production: { name: 'wp-repo' } }
  const trunkPath = path.join(scratchDir, 'wp-repo', 'trunk')
  fs.mkdirSync(trunkPath, { recursive: true })
  fs.writeFileSync(path.join(trunkPath, 'plugin.php'), '')

  await cleanWpTrunkTask()

  assert.equal(fs.existsSync(trunkPath), false)
})

test('cleanWpAssetsTask removes the production repo\'s assets directory', async () => {
  sake.config.paths.tmp = scratchDir
  sake.config.deploy = { production: { name: 'wp-repo' } }
  const assetsPath = path.join(scratchDir, 'wp-repo', 'assets')
  fs.mkdirSync(assetsPath, { recursive: true })
  fs.writeFileSync(path.join(assetsPath, 'banner.png'), '')

  await cleanWpAssetsTask()

  assert.equal(fs.existsSync(assetsPath), false)
})
