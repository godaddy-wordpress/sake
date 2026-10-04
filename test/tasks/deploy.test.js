import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import gulp from 'gulp'
import sake from '../../lib/sake.js'
import { deployTask, deployToWpRepoTask, replaceVersionTask } from '../../tasks/deploy.js'
import { promptWcUploadTask } from '../../tasks/prompt.js'
import { gitHubCreateDocsIssueTask } from '../../tasks/github.js'

let savedConfig
let savedOptions
let savedArgv

beforeEach(() => {
  savedConfig = JSON.parse(JSON.stringify(sake.config))
  savedOptions = JSON.parse(JSON.stringify(sake.options))
  savedArgv = process.argv
})

afterEach(() => {
  process.argv = savedArgv

  // see test/tasks/clean.test.js (poc/add-tests) for why this must mutate in place
  for (const key of Object.keys(sake.config)) {
    delete sake.config[key]
  }
  Object.assign(sake.config, savedConfig)

  for (const key of Object.keys(sake.options)) {
    delete sake.options[key]
  }
  Object.assign(sake.options, savedOptions)
})

// deployTask builds a long, mostly side-effecting task list and hands it to gulp.series() -
// mocking gulp.series, sake.isDeployable, and sake.validateEnvironmentVariables lets us
// assert on which conditional tasks were included, without running the real deploy pipeline
// (git push, zip creation, SVN/WC uploads, etc.) that the fixed portion of the list performs.
describe('deployTask non-interactive / dry-run gating', () => {
  const captureSeriesTasks = (t) => {
    let capturedTasks
    t.mock.method(gulp, 'series', (tasks) => {
      capturedTasks = tasks
      return (done) => done()
    })
    return () => capturedTasks
  }

  beforeEach((t) => {
    t.mock.method(sake, 'isDeployable', () => true)
    t.mock.method(sake, 'validateEnvironmentVariables', () => {})
  })

  test('--dry-run skips the WC upload / WP repo deploy steps', (t) => {
    const getCapturedTasks = captureSeriesTasks(t)
    sake.config.deploy = { type: 'wc', wooId: 123 }
    process.argv = ['node', 'sake.js', 'deploy', '--dry-run']

    deployTask(() => {})

    const tasks = getCapturedTasks()
    assert.ok(!tasks.includes(promptWcUploadTask))
    assert.ok(!tasks.includes(deployToWpRepoTask))
  })

  test('without --dry-run, the WC upload step runs for a "wc" deploy with a wooId configured', (t) => {
    const getCapturedTasks = captureSeriesTasks(t)
    sake.config.deploy = { type: 'wc', wooId: 123 }
    process.argv = ['node', 'sake.js', 'deploy']

    deployTask(() => {})

    assert.ok(getCapturedTasks().includes(promptWcUploadTask))
  })

  test('--non-interactive skips the docs issue creation step', (t) => {
    const getCapturedTasks = captureSeriesTasks(t)
    sake.config.deploy = { type: 'wc', wooId: 123 }
    process.argv = ['node', 'sake.js', 'deploy', '--non-interactive']

    deployTask(() => {})

    assert.ok(!getCapturedTasks().includes(gitHubCreateDocsIssueTask))
  })

  test('without --non-interactive, the docs issue creation step runs', (t) => {
    const getCapturedTasks = captureSeriesTasks(t)
    sake.config.deploy = { type: 'wc', wooId: 123 }
    process.argv = ['node', 'sake.js', 'deploy']

    deployTask(() => {})

    assert.ok(getCapturedTasks().includes(gitHubCreateDocsIssueTask))
  })
})

// replaceVersionTask resolves its glob patterns relative to the current working directory,
// so (unlike the mocked-gulp.series tests above) this needs a real scratch dir.
describe('replaceVersionTask --new-version fallback', () => {
  let scratchDir
  let savedCwd

  beforeEach(() => {
    scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sake-replace-version-test-'))
    savedCwd = process.cwd()
    process.chdir(scratchDir)

    sake.config.paths = { src: '.', assetPaths: { js: 'does-not-exist-js', css: 'does-not-exist-css' } }
    sake.config.plugin = { version: { current: '1.0.0' } }
  })

  afterEach(() => {
    process.chdir(savedCwd)
    fs.rmSync(scratchDir, { recursive: true, force: true })
  })

  test('falls back to --new-version when no version has been set via sake.options', async () => {
    process.argv = ['node', 'sake.js', 'replace:version', '--new-version=1.2.0']

    await new Promise((resolve, reject) => {
      const result = replaceVersionTask(resolve)
      result.on('end', resolve).on('error', reject)
    })

    assert.equal(sake.options.version, '1.2.0')
    assert.equal(sake.getVersionBump(), '1.2.0')
  })

  test('prefers an already-set sake.options.version over --new-version', async () => {
    sake.options.version = '2.0.0'
    process.argv = ['node', 'sake.js', 'replace:version', '--new-version=1.2.0']

    await new Promise((resolve, reject) => {
      const result = replaceVersionTask(resolve)
      result.on('end', resolve).on('error', reject)
    })

    assert.equal(sake.options.version, '2.0.0')
  })

  test('still throws when no version is available anywhere', () => {
    process.argv = ['node', 'sake.js', 'replace:version']

    assert.throws(
      () => replaceVersionTask(() => {}),
      /No version replacement specified/
    )
  })
})
