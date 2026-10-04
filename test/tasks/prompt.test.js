import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import inquirer from 'inquirer'
import axios from 'axios'
import { promptDeployTask, promptWcUploadTask, promptTestedReleaseZipTask } from '../../tasks/prompt.js'
import sake from '../../lib/sake.js'

// These three tasks each gained a non-interactive-mode short-circuit that skips their
// inquirer.prompt() call entirely. filterIncrement/getDefault and the existing
// interactive-mode behavior of these tasks are covered elsewhere - this file only covers
// the new non-interactive branches.

let scratchDir
let savedCwd
let savedConfig
let savedOptions
let savedArgv

beforeEach(() => {
  scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sake-prompt-noninteractive-test-'))
  savedCwd = process.cwd()
  savedConfig = JSON.parse(JSON.stringify(sake.config))
  savedOptions = JSON.parse(JSON.stringify(sake.options))
  savedArgv = process.argv

  process.chdir(scratchDir)
})

afterEach(() => {
  process.chdir(savedCwd)
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

  fs.rmSync(scratchDir, { recursive: true, force: true })
})

test('promptDeployTask uses --new-version and never prompts when set', async (t) => {
  process.argv = ['node', 'sake.js', 'deploy', '--new-version=1.2.3']

  t.mock.method(inquirer, 'prompt', async () => {
    throw new Error('inquirer.prompt should not have been called')
  })

  await new Promise((resolve) => promptDeployTask(resolve))

  assert.equal(sake.options.version, '1.2.3')
})

test('promptWcUploadTask skips the prompt and auto-uploads in non-interactive mode', async (t) => {
  process.argv = ['node', 'sake.js', 'deploy', '--non-interactive']

  fs.mkdirSync('build', { recursive: true })
  fs.writeFileSync(path.join('build', 'my-plugin.1.0.0.zip'), 'zip contents')

  sake.config.plugin = { id: 'my-plugin', version: { current: '1.0.0' } }
  sake.config.paths = { build: 'build' }

  t.mock.method(inquirer, 'prompt', async () => {
    throw new Error('inquirer.prompt should not have been called')
  })

  let postCount = 0
  t.mock.method(axios, 'post', async (url) => {
    postCount++
    return url.includes('deploy/status') ? { data: { version: '0.1.0' } } : { data: { success: true } }
  })

  await new Promise((resolve) => promptWcUploadTask(resolve))

  assert.equal(postCount, 2)
})

test('promptTestedReleaseZipTask skips the prompt and completes immediately in non-interactive mode', async (t) => {
  process.argv = ['node', 'sake.js', 'deploy', '--non-interactive']

  t.mock.method(inquirer, 'prompt', async () => {
    throw new Error('inquirer.prompt should not have been called')
  })

  await new Promise((resolve) => promptTestedReleaseZipTask(resolve))
})
