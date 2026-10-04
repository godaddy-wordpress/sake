import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import gulp from 'gulp'
import sake from '../../lib/sake.js'
import { compile } from '../../tasks/compile.js'
import { lintPhpTask } from '../../tasks/lint.js'

// compile() builds a task list and hands it to gulp.parallel() - mocking gulp.parallel lets
// us assert on exactly which tasks were included without actually running them (scripts,
// styles, image minification, etc. all touch real files and are out of scope here).
let savedOptions

beforeEach(() => {
  savedOptions = JSON.parse(JSON.stringify(sake.options))
  // isolate the --skip-linting gating from the unrelated skip_pot gating
  sake.options.skip_pot = true
})

afterEach(() => {
  // see test/tasks/clean.test.js (poc/add-tests) for why this must mutate in place
  for (const key of Object.keys(sake.options)) {
    delete sake.options[key]
  }
  Object.assign(sake.options, savedOptions)
})

const captureParallelTasks = (t) => {
  let capturedTasks
  t.mock.method(gulp, 'parallel', (tasks) => {
    capturedTasks = tasks
    return (done) => done()
  })
  return () => capturedTasks
}

test('compile includes lintPhpTask by default', (t) => {
  const getCapturedTasks = captureParallelTasks(t)
  const savedArgv = process.argv
  process.argv = ['node', 'sake.js', 'compile']

  try {
    compile(() => {})
  } finally {
    process.argv = savedArgv
  }

  assert.ok(getCapturedTasks().includes(lintPhpTask))
})

test('compile excludes lintPhpTask when --skip-linting is passed', (t) => {
  const getCapturedTasks = captureParallelTasks(t)
  const savedArgv = process.argv
  process.argv = ['node', 'sake.js', 'compile', '--skip-linting']

  try {
    compile(() => {})
  } finally {
    process.argv = savedArgv
  }

  assert.ok(!getCapturedTasks().includes(lintPhpTask))
})
