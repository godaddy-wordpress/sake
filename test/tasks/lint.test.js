import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runESLint } from '../../tasks/lint.js'

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
