// Throwaway smoke check for Phase 0: proves every tasks/*.js file can be
// imported under SAKE_TEST_MODE without crashing, from both the repo root
// and the fixture plugin directory. Delete this file once Phase 1 covers
// the same import surface with real assertions.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { enterFixturePlugin, exitFixturePlugin } from './support/fixture-plugin.js'

const taskFiles = [
  '../tasks/build.js',
  '../tasks/bump.js',
  '../tasks/bundle.js',
  '../tasks/clean.js',
  '../tasks/compile.js',
  '../tasks/config.js',
  '../tasks/copy.js',
  '../tasks/decaffeinate.js',
  '../tasks/deploy.js',
  '../tasks/github.js',
  '../tasks/imagemin.js',
  '../tasks/lint.js',
  '../tasks/makepot.js',
  '../tasks/prerelease.js',
  '../tasks/prompt.js',
  '../tasks/scripts.js',
  '../tasks/shell.js',
  '../tasks/styles.js',
  '../tasks/upfw.js',
  '../tasks/validate.js',
  '../tasks/watch.js',
  '../tasks/wc.js',
  '../tasks/zip.js'
]

test('every tasks/*.js file imports cleanly from the repo root', async () => {
  for (const file of taskFiles) {
    await assert.doesNotReject(() => import(file), `failed to import ${file}`)
  }
})

test('every tasks/*.js file imports cleanly with cwd set to the fixture plugin dir', async () => {
  enterFixturePlugin()

  try {
    for (const file of taskFiles) {
      await assert.doesNotReject(() => import(file), `failed to import ${file}`)
    }
  } finally {
    exitFixturePlugin()
  }
})
