import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sake from '../../lib/sake.js'
import { runESLint, lintCoffeeTask, lintScssTask } from '../../tasks/lint.js'

const cleanFile = 'test/fixtures/eslint-samples/clean.js'
const brokenFile = 'test/fixtures/eslint-samples/broken.js'

test('runESLint reports no errors or warnings for a clean file', async () => {
  const result = await runESLint([cleanFile], { taskName: 'clean-check' })

  assert.deepEqual(result, { errorCount: 0, warningCount: 0, fixableCount: 0 })
})

test('runESLint reports the exact error/warning counts for a broken file', async () => {
  const result = await runESLint([brokenFile], { taskName: 'broken-check' })

  // one missing-semicolon error, one eqeqeq warning, both auto-fixable
  assert.deepEqual(result, { errorCount: 1, warningCount: 1, fixableCount: 1 })
})

test('runESLint accepts a single file path string (no glob) directly', async () => {
  const result = await runESLint(cleanFile, { taskName: 'string-path-check' })

  assert.deepEqual(result, { errorCount: 0, warningCount: 0, fixableCount: 0 })
})

test('runESLint returns zero counts when no files match the given pattern', async () => {
  const result = await runESLint(['test/fixtures/eslint-samples/does-not-exist-*.js'], { taskName: 'no-match-check' })

  assert.deepEqual(result, { errorCount: 0, warningCount: 0, fixableCount: 0 })
})

test('runESLint throws when failOnErrors is set and errors are found', async () => {
  await assert.rejects(
    () => runESLint([brokenFile], { taskName: 'fail-on-errors-check', failOnErrors: true }),
    /fail-on-errors-check found 1 error\(s\) and 1 warning\(s\)/
  )
})

// lintCoffeeTask/lintScssTask resolve their glob patterns relative to the current working
// directory, so (unlike the runESLint tests above) these need their own scratch dir and
// chdir - scoped to this describe block so it doesn't disturb cwd for the ESLint tests
// above (ESLint's own config/plugin resolution is cwd-sensitive, and ran against the
// wrong rule set the first time this was tried with a file-wide chdir).
describe('lintCoffeeTask / lintScssTask', () => {
  // lintCoffeeTask/lintScssTask return a gulp stream with only `.on('end')`/`.on('error')`
  // listeners attached and no downstream consumer (no `.dest()`, no `.pipe()` sink) - a
  // Readable stream only emits 'end' once something puts it in flowing mode (a 'data'
  // listener, `.resume()`, or a pipe target). Gulp's own task runner resumes any stream a
  // task returns, which is why this isn't an issue for real CLI usage, but calling the task
  // function directly (as these tests do) requires resuming it manually or `done` is never
  // called and the stream just sits there. Some branches (shouldSkipLinting, missing asset
  // dir) return a Promise instead of a stream and never call `done` at all - await that
  // Promise directly in that case.
  const runLintTask = (task) => new Promise((resolve, reject) => {
    const result = task((err) => (err ? reject(err) : resolve(undefined)))

    if (result && typeof result.then === 'function') {
      result.then(() => resolve(undefined), reject)
    } else if (result && typeof result.resume === 'function') {
      result.resume()
    }
  })

  let scratchDir
  let savedCwd
  let savedConfig

  beforeEach(() => {
    scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sake-lint-test-'))
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

  test('lintCoffeeTask passes for a clean .coffee file', async () => {
    sake.buildPaths()
    fs.mkdirSync(sake.config.paths.assetPaths.js, { recursive: true })
    fs.writeFileSync(path.join(sake.config.paths.assetPaths.js, 'clean.coffee'), 'foo = ->\n console.log "hi"\n')

    await assert.doesNotReject(() => runLintTask(lintCoffeeTask))
  })

  test('lintCoffeeTask fails for a .coffee file with a lint error', async () => {
    sake.buildPaths()
    fs.mkdirSync(sake.config.paths.assetPaths.js, { recursive: true })
    // trailing whitespace is an "error"-level rule in lib/lintfiles/coffeelint.json
    fs.writeFileSync(path.join(sake.config.paths.assetPaths.js, 'broken.coffee'), 'foo = ->\n console.log "hi"   \n')

    await assert.rejects(() => runLintTask(lintCoffeeTask))
  })

  test('lintCoffeeTask is a no-op when the JS asset directory does not exist', async () => {
    sake.buildPaths()
    // scratchDir has no assets/js at all

    await assert.doesNotReject(() => runLintTask(lintCoffeeTask))
  })

  test('lintCoffeeTask is a no-op when --skip-linting is passed', async () => {
    sake.buildPaths()
    fs.mkdirSync(sake.config.paths.assetPaths.js, { recursive: true })
    fs.writeFileSync(path.join(sake.config.paths.assetPaths.js, 'broken.coffee'), 'foo = ->\n console.log "hi"   \n')

    process.argv.push('--skip-linting')
    try {
      await assert.doesNotReject(() => runLintTask(lintCoffeeTask))
    } finally {
      process.argv.pop()
    }
  })

  test('lintScssTask passes for a clean .scss file', async () => {
    sake.buildPaths()
    fs.mkdirSync(sake.config.paths.assetPaths.css, { recursive: true })
    fs.writeFileSync(path.join(sake.config.paths.assetPaths.css, 'clean.scss'), '.foo {\n  color: red;\n}\n')

    await assert.doesNotReject(() => runLintTask(lintScssTask))
  })

  test('lintScssTask never fails the build, even when stylelint reports an error', async () => {
    // bug: `lintScssTask` runs stylelint as a postcss plugin (`postcss([stylelint({...})])`)
    // and passes `failAfterError: !fixFlag`, but stylelint v17's postcss-plugin interface no
    // longer recognizes a `failAfterError` option (it was removed along with the rest of the
    // old postcss-plugin API in stylelint v15+) - the option is silently ignored. stylelint
    // still runs and reports the violation to the console, but the gulp stream never emits an
    // error and the task always resolves successfully, regardless of lint errors found.
    sake.buildPaths()
    fs.mkdirSync(sake.config.paths.assetPaths.css, { recursive: true })
    // uppercase hex is flagged by stylelint-config-standard-scss's color-hex-length rule
    fs.writeFileSync(path.join(sake.config.paths.assetPaths.css, 'broken.scss'), '.foo {\n  color: #FFFFFF;\n}\n')

    await assert.doesNotReject(() => runLintTask(lintScssTask))
  })

  test('lintScssTask auto-fixes lint errors on disk when --fix is passed', async () => {
    sake.buildPaths()
    fs.mkdirSync(sake.config.paths.assetPaths.css, { recursive: true })
    const scssFile = path.join(sake.config.paths.assetPaths.css, 'broken.scss')
    fs.writeFileSync(scssFile, '.foo {\n  color: #FFFFFF;\n}\n')

    process.argv.push('--fix')
    try {
      await assert.doesNotReject(() => runLintTask(lintScssTask))
    } finally {
      process.argv.pop()
    }

    assert.match(fs.readFileSync(scssFile, 'utf8'), /#FFF\b/)
  })

  test('lintScssTask is a no-op when the CSS asset directory does not exist', async () => {
    sake.buildPaths()
    // scratchDir has no assets/css at all

    await assert.doesNotReject(() => runLintTask(lintScssTask))
  })

  test('lintScssTask is a no-op when --skip-linting is passed', async () => {
    sake.buildPaths()
    fs.mkdirSync(sake.config.paths.assetPaths.css, { recursive: true })
    fs.writeFileSync(path.join(sake.config.paths.assetPaths.css, 'broken.scss'), '.foo {\n  color: #FFFFFF;\n}\n')

    process.argv.push('--skip-linting')
    try {
      await assert.doesNotReject(() => runLintTask(lintScssTask))
    } finally {
      process.argv.pop()
    }
  })
})
