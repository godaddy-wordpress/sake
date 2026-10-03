import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import shell from 'shelljs'
import sake from '../../lib/sake.js'
import { processBundle, bundleScriptsTask, bundleStylesTask, bundleTask } from '../../tasks/bundle.js'

let scratchDir
let savedCwd
let savedConfig

beforeEach(() => {
  scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sake-bundle-test-'))
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

test('processBundle calls done once with no error when the bundle array is empty', () => {
  const doneCalls = []
  processBundle('scripts', [], (err) => doneCalls.push(err))

  assert.deepEqual(doneCalls, [undefined])
})

test('processBundle calls done once with no error when the bundle array is missing', () => {
  const doneCalls = []
  processBundle('scripts', undefined, (err) => doneCalls.push(err))

  assert.deepEqual(doneCalls, [undefined])
})

test('processBundle copies a package file into the destination, creating the folder if needed', (t) => {
  const pkgDir = path.join(scratchDir, 'node_modules', 'some-package')
  fs.mkdirSync(pkgDir, { recursive: true })
  fs.writeFileSync(path.join(pkgDir, 'dist.js'), 'console.log("hi");')

  const doneCalls = []
  processBundle('scripts', [
    { source: 'some-package', file: 'dist.js', destination: 'assets/js/vendor' }
  ], (err) => doneCalls.push(err))

  assert.deepEqual(doneCalls, [undefined])
  assert.equal(fs.readFileSync(path.join(scratchDir, 'assets/js/vendor', 'dist.js'), 'utf8'), 'console.log("hi");')
})

test('processBundle reports a missing package via throwError, and calls done once per failed item plus once more at the end', (t) => {
  // the forEach loop has no way to break early, and calls `done` again
  // unconditionally after the loop regardless of errors - so for N failing
  // items, done ends up called N+1 times. Documenting the real behavior
  // rather than an idealized "called once" contract.
  const thrownMessages = []
  t.mock.method(sake, 'throwError', (message) => { thrownMessages.push(message) })

  const doneCalls = []
  processBundle('scripts', [
    { source: 'missing-pkg-1', file: 'a.js', destination: 'vendor' },
    { source: 'missing-pkg-2', file: 'b.js', destination: 'vendor' }
  ], (err) => doneCalls.push(err))

  assert.equal(thrownMessages.length, 2)
  assert.match(thrownMessages[0], /Package 'missing-pkg-1' not found in node_modules\./)
  assert.match(thrownMessages[1], /Package 'missing-pkg-2' not found in node_modules\./)

  assert.equal(doneCalls.length, 3)
  assert.match(doneCalls[0], /missing-pkg-1/)
  assert.match(doneCalls[1], /missing-pkg-2/)
  assert.equal(doneCalls[2], undefined)
})

test('processBundle reports a copy error via throwError when the source file does not exist in the package', (t) => {
  const pkgDir = path.join(scratchDir, 'node_modules', 'some-package')
  fs.mkdirSync(pkgDir, { recursive: true })
  // deliberately not creating dist.js inside it

  const thrownMessages = []
  t.mock.method(sake, 'throwError', (message) => { thrownMessages.push(message) })

  const doneCalls = []
  processBundle('scripts', [
    { source: 'some-package', file: 'dist.js', destination: 'assets/js/vendor' }
  ], (err) => doneCalls.push(err))

  assert.equal(thrownMessages.length, 1)
  assert.match(thrownMessages[0], /Error copying 'dist\.js'/)
  // done is called once for the copy error, then once more unconditionally
  assert.equal(doneCalls.length, 2)
})

test('bundleScriptsTask delegates to processBundle with sake.config.bundle.scripts', (t) => {
  const pkgDir = path.join(scratchDir, 'node_modules', 'some-package')
  fs.mkdirSync(pkgDir, { recursive: true })
  fs.writeFileSync(path.join(pkgDir, 'dist.js'), 'scripts content')

  sake.config.bundle = {
    scripts: [{ source: 'some-package', file: 'dist.js', destination: 'assets/js/vendor' }]
  }

  const doneCalls = []
  bundleScriptsTask((err) => doneCalls.push(err))

  assert.deepEqual(doneCalls, [undefined])
  assert.equal(fs.readFileSync(path.join(scratchDir, 'assets/js/vendor', 'dist.js'), 'utf8'), 'scripts content')
})

test('bundleStylesTask delegates to processBundle with sake.config.bundle.styles', (t) => {
  const pkgDir = path.join(scratchDir, 'node_modules', 'some-package')
  fs.mkdirSync(pkgDir, { recursive: true })
  fs.writeFileSync(path.join(pkgDir, 'dist.css'), 'styles content')

  sake.config.bundle = {
    styles: [{ source: 'some-package', file: 'dist.css', destination: 'assets/css/vendor' }]
  }

  const doneCalls = []
  bundleStylesTask((err) => doneCalls.push(err))

  assert.deepEqual(doneCalls, [undefined])
  assert.equal(fs.readFileSync(path.join(scratchDir, 'assets/css/vendor', 'dist.css'), 'utf8'), 'styles content')
})

// bundleTask's `gulp.parallel(tasks)(done)` call completes asynchronously (at least one
// tick later), unlike processBundle's done calls elsewhere in this file - so these wait a
// beat and collect every call made within that window, rather than asserting synchronously
// right after calling the task.
const collectDoneCalls = (task) => new Promise((resolve) => {
  const doneCalls = []
  task((err) => doneCalls.push(err))
  setTimeout(() => resolve(doneCalls), 50)
})

test('bundleTask skips npm install entirely when sake.config.bundle is not set', async (t) => {
  let execCalled = false
  t.mock.method(shell, 'exec', () => { execCalled = true; return { code: 0 } })

  const doneCalls = await collectDoneCalls(bundleTask)

  assert.equal(execCalled, false)
  assert.deepEqual(doneCalls, [undefined])
})

test('bundleTask runs npm install first when sake.config.bundle is set', async (t) => {
  sake.config.bundle = { scripts: [] }

  let capturedCommand
  t.mock.method(shell, 'exec', (command) => {
    capturedCommand = command
    return { code: 0 }
  })

  const doneCalls = await collectDoneCalls(bundleTask)

  assert.equal(capturedCommand, 'npm install')
  assert.deepEqual(doneCalls, [undefined])
})

test('bundleTask reports a failed npm install via throwError, then calls done a second time regardless', async (t) => {
  // bug: tasks/bundle.js:76-80 - when `npm install` fails, this branch calls
  // `sake.throwError(...)` (which throws synchronously in real usage, so in practice this
  // is unreachable) immediately followed by `done(npmInstall.stderr)`, with no `return`
  // afterward. Execution falls through to the unconditional `gulp.parallel(tasks)(done)`
  // below, which calls `done` a second time (with no error, once bundleScriptsTask/
  // bundleStylesTask complete) regardless of the earlier npm install failure. Only
  // observable with throwError mocked out, same as elsewhere in this codebase - confirmed
  // here that `done` fires twice (`npmInstall.stderr`, then `undefined`).
  sake.config.bundle = { scripts: [] }

  t.mock.method(shell, 'exec', () => ({ code: 1, stdout: '', stderr: 'npm boom' }))

  const thrownMessages = []
  t.mock.method(sake, 'throwError', (message) => { thrownMessages.push(message) })

  const doneCalls = await collectDoneCalls(bundleTask)

  assert.deepEqual(thrownMessages, ['Error during npm install: npm boom'])
  assert.deepEqual(doneCalls, ['npm boom', undefined])
})
