import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sake from '../../lib/sake.js'
import { bumpTask, bumpMinReqsTask, bumpFrameworkVersionTask } from '../../tasks/bump.js'

const awaitStream = (stream) => new Promise((resolve, reject) => {
  stream.on('end', resolve).on('error', reject)
})

let scratchDir
let savedCwd
let savedConfig
let savedOptions

beforeEach(() => {
  scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sake-bump-test-'))
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

test('bumpTask updates the version in the main plugin file and includes/Plugin.php for v5 framework plugins', async () => {
  sake.config.paths.src = '.'
  sake.config.framework = 'v5'
  sake.config.plugin = { mainFile: 'main-plugin.php', version: { current: '1.5.0' } }

  fs.writeFileSync(path.join(scratchDir, 'main-plugin.php'), '<?php\n/**\n * Version: 1.0.0\n */\n')
  fs.mkdirSync(path.join(scratchDir, 'includes'))
  fs.writeFileSync(path.join(scratchDir, 'includes', 'Plugin.php'), "<?php\nclass Plugin {\n\tconst VERSION = '1.0.0';\n}\n")

  await awaitStream(bumpTask())

  assert.match(fs.readFileSync(path.join(scratchDir, 'main-plugin.php'), 'utf8'), /Version: 1\.5\.0/)
  assert.match(fs.readFileSync(path.join(scratchDir, 'includes', 'Plugin.php'), 'utf8'), /VERSION = '1\.5\.0'/)
})

test('bumpTask does not touch includes/Plugin.php for non-v5-framework plugins', async () => {
  sake.config.paths.src = '.'
  sake.config.framework = 'v4'
  sake.config.plugin = { mainFile: 'main-plugin.php', version: { current: '1.5.0' } }

  fs.writeFileSync(path.join(scratchDir, 'main-plugin.php'), '<?php\n/**\n * Version: 1.0.0\n */\n')
  fs.mkdirSync(path.join(scratchDir, 'includes'))
  fs.writeFileSync(path.join(scratchDir, 'includes', 'Plugin.php'), "<?php\nclass Plugin {\n\tconst VERSION = '1.0.0';\n}\n")

  await awaitStream(bumpTask())

  assert.match(fs.readFileSync(path.join(scratchDir, 'main-plugin.php'), 'utf8'), /Version: 1\.5\.0/)
  assert.match(fs.readFileSync(path.join(scratchDir, 'includes', 'Plugin.php'), 'utf8'), /VERSION = '1\.0\.0'/)
})

test('bumpMinReqsTask updates WP/WC min and tested-up-to versions in the main file and readme.txt', async () => {
  sake.config.paths.src = '.'
  sake.config.framework = 'v4'
  sake.config.plugin = { mainFile: 'main-plugin.php' }
  sake.options.minimum_wp_version = '6.5'
  sake.options.tested_up_to_wp_version = '6.6'
  sake.options.minimum_wc_version = '8.0'
  sake.options.tested_up_to_wc_version = '9.0'
  sake.options.backwards_compatible = '5.0'

  fs.writeFileSync(path.join(scratchDir, 'main-plugin.php'), "<?php\n\t'minimum_wp_version' => '5.0',\n\t'minimum_wc_version' => '3.0',\n\t'backwards_compatible' => '4.0',\n")
  fs.writeFileSync(path.join(scratchDir, 'readme.txt'), '=== Test Plugin ===\nRequires at least: 5.0\nTested up to: 6.0\nWC requires at least: 3.0\nWC tested up to: 7.0\n')

  await awaitStream(bumpMinReqsTask())

  const mainFile = fs.readFileSync(path.join(scratchDir, 'main-plugin.php'), 'utf8')
  assert.match(mainFile, /'minimum_wp_version' => '6\.5'/)
  assert.match(mainFile, /'minimum_wc_version' => '8\.0'/)
  // backwards_compatible is only replaced for v4-framework plugins, which this test sets up
  assert.match(mainFile, /'backwards_compatible' => '5\.0'/)

  const readme = fs.readFileSync(path.join(scratchDir, 'readme.txt'), 'utf8')
  assert.match(readme, /Requires at least: 6\.5/)
  assert.match(readme, /Tested up to: 6\.6/)
  assert.match(readme, /WC requires at least: 8\.0/)
  assert.match(readme, /WC tested up to: 9\.0/)
})

test('bumpMinReqsTask never updates MINIMUM_PHP_VERSION, regardless of options.minimum_php_version', async () => {
  // pipes/replace.js's replaceMinimumPhpVersion builds its replacement string
  // (`MINIMUM_PHP_VERSION = '${sake.options.minimum_php_version}';\n`) directly
  // as a plain template literal argument to .pipe(replace, regex, STRING),
  // not a function like every other replace* pipe in that file. That string
  // is evaluated once, when pipes/replace.js is first imported into the
  // process - which already happened (transitively, via this test file's own
  // static import of tasks/bump.js) before this test body ever runs, and
  // before options.minimum_php_version had any value set. So this always
  // writes 'undefined', no matter what options.minimum_php_version is set to
  // afterward, in this test or in any other code path that imports
  // pipes/replace.js before setting the option.
  sake.config.paths.src = '.'
  sake.config.framework = 'v4'
  sake.config.plugin = { mainFile: 'main-plugin.php' }
  sake.options.minimum_php_version = '7.4'

  fs.writeFileSync(path.join(scratchDir, 'main-plugin.php'), "<?php\nMINIMUM_PHP_VERSION = '7.0';\n")
  fs.writeFileSync(path.join(scratchDir, 'readme.txt'), '=== Test Plugin ===\n')

  await awaitStream(bumpMinReqsTask())

  const mainFile = fs.readFileSync(path.join(scratchDir, 'main-plugin.php'), 'utf8')
  assert.match(mainFile, /MINIMUM_PHP_VERSION = 'undefined';/)
})

test('bumpFrameworkVersionTask updates FRAMEWORK_VERSION in plugin php files', async () => {
  sake.config.paths.src = '.'
  sake.config.paths.framework = { base: 'vendor/skyverge/wc-plugin-framework' }
  sake.options.framework_version = '5.14.0'

  fs.writeFileSync(path.join(scratchDir, 'main-plugin.php'), "<?php\nFRAMEWORK_VERSION = '5.10.0';\n")

  await awaitStream(bumpFrameworkVersionTask())

  assert.match(fs.readFileSync(path.join(scratchDir, 'main-plugin.php'), 'utf8'), /FRAMEWORK_VERSION = '5\.14\.0'/)
})

test('bumpFrameworkVersionTask also updates files inside the framework vendor directory, despite the apparent exclude', async () => {
  // the exclude pattern is `!${src}/${framework.base}` with no /** suffix,
  // which only excludes that exact directory entry, not its contents - so
  // gulp.src's glob still matches every .php file inside it via the
  // `${src}/**/*.php` pattern. This is almost certainly unintended (the
  // comment/intent is clearly to leave the vendored framework's own files
  // alone), but it's what the code currently does.
  sake.config.paths.src = '.'
  sake.config.paths.framework = { base: 'vendor/skyverge/wc-plugin-framework' }
  sake.options.framework_version = '5.14.0'

  const frameworkDir = path.join(scratchDir, 'vendor', 'skyverge', 'wc-plugin-framework')
  fs.mkdirSync(frameworkDir, { recursive: true })
  fs.writeFileSync(path.join(frameworkDir, 'loader.php'), "<?php\nFRAMEWORK_VERSION = '5.10.0';\n")

  await awaitStream(bumpFrameworkVersionTask())

  assert.match(fs.readFileSync(path.join(frameworkDir, 'loader.php'), 'utf8'), /FRAMEWORK_VERSION = '5\.14\.0'/)
})
