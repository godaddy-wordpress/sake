import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sake from '../../lib/sake.js'
import {
  buildCopyBuildPaths,
  copyPrereleaseTask,
  copyWcRepoTask,
  copyWpTrunkTask,
  copyWpAssetsTask,
  copyWpTagTask
} from '../../tasks/copy.js'

const awaitStream = (stream) => new Promise((resolve, reject) => {
  stream.on('end', resolve).on('error', reject)
})

let scratchDir
let savedCwd
let savedConfig
let savedEnv

beforeEach(() => {
  scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sake-copy-test-'))
  savedCwd = process.cwd()
  savedConfig = JSON.parse(JSON.stringify(sake.config))
  savedEnv = process.env.SAKE_PRE_RELEASE_PATH

  process.chdir(scratchDir)
})

afterEach(() => {
  process.chdir(savedCwd)

  // see test/tasks/clean.test.js for why this must mutate in place
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

test('buildCopyBuildPaths includes v5 framework excludes for a frameworked wc plugin', () => {
  sake.config.framework = 'v5'
  sake.config.paths.framework = {
    base: 'vendor/skyverge/wc-plugin-framework',
    general: { css: 'woocommerce/assets/css', js: 'woocommerce/assets/js' },
    gateway: { css: 'woocommerce/payment-gateway/assets/css', js: 'woocommerce/payment-gateway/assets/js' }
  }
  sake.config.deploy = { type: 'wc' }
  sake.config.paths.vendor = 'vendor'

  const paths = buildCopyBuildPaths()

  assert.equal(paths.includes('!./vendor/skyverge/wc-plugin-framework/woocommerce/woocommerce-framework-plugin-loader-sample.php'), true)
  assert.equal(paths.some((p) => p.includes('wpAssets') || p === '!wp-assets{,/**}'), false)
})

test('buildCopyBuildPaths excludes the wp assets dir for a non-frameworked wp plugin', () => {
  sake.config.framework = false
  sake.config.deploy = { type: 'wp' }
  sake.config.paths.wpAssets = 'wp-assets'
  sake.config.paths.vendor = 'vendor'

  const paths = buildCopyBuildPaths()

  assert.equal(paths.includes('!wp-assets{,/**}'), true)
  assert.equal(paths.some((p) => p.includes('framework')), false)
})

test('buildCopyBuildPaths excludes composer require-dev packages and binaries, unless autoload is set', () => {
  sake.config.framework = false
  sake.config.deploy = { type: 'wc' }
  sake.config.paths.vendor = 'vendor'
  sake.config.composer = { require: {}, 'require-dev': { 'some-vendor/dev-package': '^1.0' } }
  sake.config.autoload = false

  const paths = buildCopyBuildPaths()

  assert.equal(paths.includes('!vendor/some-vendor{,/**}'), true)
  assert.equal(paths.includes('!vendor/bin{,/**}'), true)
  assert.equal(paths.includes('!vendor/composer{,/**}'), true)
  assert.equal(paths.includes('!vendor/autoload.php'), true)
})

test('buildCopyBuildPaths excludes any custom configured paths', () => {
  sake.config.framework = false
  sake.config.deploy = { type: 'wc' }
  sake.config.paths.vendor = 'vendor'
  sake.config.paths.exclude = ['custom/path']

  const paths = buildCopyBuildPaths()

  assert.equal(paths.includes('!custom/path{,/**}'), true)
})

test('copyPrereleaseTask copies and renames the build zip and changelog into the prereleases path', async () => {
  process.env.SAKE_PRE_RELEASE_PATH = scratchDir
  sake.config.deploy = { type: 'wc' }
  sake.config.plugin = { id: 'my-plugin' }

  const buildDir = path.join(scratchDir, 'build', 'my-plugin')
  fs.mkdirSync(buildDir, { recursive: true })
  fs.writeFileSync(path.join(scratchDir, 'build', 'my-plugin-1.0.0.zip'), 'zip contents')
  fs.writeFileSync(path.join(buildDir, 'changelog.txt'), 'changelog contents')

  await awaitStream(copyPrereleaseTask())

  // the zip keeps its original name - the filter/restore dance only
  // renames the changelog, since the filter only matches `**/changelog.txt`
  assert.equal(fs.existsSync(path.join(scratchDir, 'my-plugin-1.0.0.zip')), true)
  assert.equal(fs.existsSync(path.join(scratchDir, 'my-plugin_changelog.txt')), true)
})

test('copyWcRepoTask copies the built plugin into the production repo path', async () => {
  sake.config.paths.tmp = scratchDir
  sake.config.deploy = { production: { name: 'wc-repo' } }
  sake.config.plugin = { id: 'my-plugin' }

  const buildDir = path.join(scratchDir, 'build', 'my-plugin')
  fs.mkdirSync(buildDir, { recursive: true })
  fs.writeFileSync(path.join(buildDir, 'my-plugin.php'), 'plugin contents')

  await awaitStream(copyWcRepoTask())

  assert.equal(fs.existsSync(path.join(scratchDir, 'wc-repo', 'my-plugin.php')), true)
})

test('copyWpTrunkTask copies the built plugin into the production repo\'s trunk', async () => {
  sake.config.paths.tmp = scratchDir
  sake.config.deploy = { production: { name: 'wp-repo' } }
  sake.config.plugin = { id: 'my-plugin' }

  const buildDir = path.join(scratchDir, 'build', 'my-plugin')
  fs.mkdirSync(buildDir, { recursive: true })
  fs.writeFileSync(path.join(buildDir, 'my-plugin.php'), 'plugin contents')

  await awaitStream(copyWpTrunkTask())

  assert.equal(fs.existsSync(path.join(scratchDir, 'wp-repo', 'trunk', 'my-plugin.php')), true)
})

test('copyWpAssetsTask copies the wp-assets directory into the production repo\'s assets folder', async () => {
  sake.config.paths.tmp = scratchDir
  sake.config.deploy = { production: { name: 'wp-repo' } }
  sake.config.paths.wpAssets = 'wp-assets'

  fs.mkdirSync(path.join(scratchDir, 'wp-assets'), { recursive: true })
  fs.writeFileSync(path.join(scratchDir, 'wp-assets', 'banner.png'), 'binary contents')

  await awaitStream(copyWpAssetsTask())

  assert.equal(fs.existsSync(path.join(scratchDir, 'wp-repo', 'assets', 'banner.png')), true)
})

test('copyWpTagTask copies the trunk directory into a version-named tag directory', async () => {
  sake.config.paths.tmp = scratchDir
  sake.config.deploy = { production: { name: 'wp-repo' } }
  sake.config.plugin = { version: { current: '1.2.3' } }

  const trunkDir = path.join(scratchDir, 'wp-repo', 'trunk')
  fs.mkdirSync(trunkDir, { recursive: true })
  fs.writeFileSync(path.join(trunkDir, 'my-plugin.php'), 'plugin contents')

  await awaitStream(copyWpTagTask())

  assert.equal(fs.existsSync(path.join(scratchDir, 'wp-repo', 'tags', '1.2.3', 'my-plugin.php')), true)
})
