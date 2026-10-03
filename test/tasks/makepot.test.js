import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import shell from 'shelljs'
import sake from '../../lib/sake.js'
import { makepotTask } from '../../tasks/makepot.js'

let savedConfig

beforeEach(() => {
  savedConfig = JSON.parse(JSON.stringify(sake.config))

  sake.config.plugin = { id: 'my-plugin' }
})

afterEach(() => {
  // see test/tasks/clean.test.js for why this must mutate in place
  for (const key of Object.keys(sake.config)) {
    delete sake.config[key]
  }
  Object.assign(sake.config, savedConfig)
})

test('makepotTask runs wp i18n make-pot with the configured domain path, headers, and standard excludes', async (t) => {
  sake.config.tasks = { makepot: { domainPath: 'i18n/languages', reportBugsTo: 'https://example.com/report' } }

  let capturedCommand
  t.mock.method(shell, 'exec', (command) => {
    capturedCommand = command
    return { code: 0, stdout: 'done', stderr: '' }
  })

  await new Promise((resolve) => makepotTask(resolve))

  assert.equal(
    capturedCommand,
    'wp i18n make-pot . i18n/languages/my-plugin.pot  --headers=\'{"Report-Msgid-Bugs-To": "https://example.com/report"}\' --exclude=".github/.*" --exclude="lib/.*" --exclude="vendor/.*" --exclude="tests/.*" --exclude="node_modules/.*"'
  )
})

test('makepotTask defaults the domain path and omits headers when none are configured', async (t) => {
  sake.config.tasks = { makepot: {} }

  let capturedCommand
  t.mock.method(shell, 'exec', (command) => {
    capturedCommand = command
    return { code: 0, stdout: '', stderr: '' }
  })

  await new Promise((resolve) => makepotTask(resolve))

  assert.match(capturedCommand, /^wp i18n make-pot \. i18n\/languages\/my-plugin\.pot {2} --exclude/)
})

test('makepotTask reports a wp-cli failure via throwError', async (t) => {
  // like shellGitEnsureCleanWorkingCopyTask's dirty-working-copy check: sake.throwError()
  // throws synchronously by design here, so in real usage this crashes the process rather
  // than ever reaching the `done(result.stderr)` on the next line - that line only runs at
  // all when throwError is mocked out, as it is here, to observe the message without
  // crashing the test process; `done` happens to still get called in that mocked case
  // (unlike the "hangs forever" bugs documented elsewhere), since nothing here prevents
  // the function from reaching its last line once the mocked throwError returns normally.
  sake.config.tasks = { makepot: {} }

  t.mock.method(shell, 'exec', () => ({ code: 1, stdout: '', stderr: 'boom error' }))

  const thrownMessages = []
  t.mock.method(sake, 'throwError', (message) => { thrownMessages.push(message) })

  const result = await new Promise((resolve) => makepotTask(resolve))

  assert.equal(result, 'boom error')
  assert.deepEqual(thrownMessages, ['Error while generating POT file: boom error'])
})
