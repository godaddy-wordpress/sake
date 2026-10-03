import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import inquirer from 'inquirer'
import sake from '../../lib/sake.js'
import {
  getTuesdays,
  getMonthlyMilestones,
  getGithub,
  gitHubGetReleaseIssueTask,
  gitHubGetWcIssuesTask,
  gitHubCreateDocsIssueTask,
  gitHubCreateReleaseTask,
  gitHubCreateReleaseMilestonesTask,
  gitHubCreateMonthMilestonesTask
} from '../../tasks/github.js'

test('getTuesdays returns one entry per Tuesday in the given year', () => {
  const tuesdays = getTuesdays(2024)

  // 2024 is a leap year starting on a Monday, so it has 53 Tuesdays
  assert.equal(tuesdays.length, 53)
  assert.equal(tuesdays.every((t) => t.date.getDay() === 2), true)
  assert.equal(tuesdays.every((t) => t.date.getFullYear() === 2024), true)
})

test('getTuesdays names each milestone with its MM/DD date', () => {
  const [first] = getTuesdays(2024)

  assert.equal(first.name, 'Deploy on 01/02')
})

test('getTuesdays accepts a string year', () => {
  const asString = getTuesdays('2024')
  const asNumber = getTuesdays(2024)

  assert.equal(asString.length, asNumber.length)
  assert.deepEqual(asString[0].name, asNumber[0].name)
})

test('getMonthlyMilestones returns exactly 12 entries for the given year', () => {
  const months = getMonthlyMilestones(2024)

  assert.equal(months.length, 12)
})

test('getMonthlyMilestones dates each milestone on the last day of its month', () => {
  const months = getMonthlyMilestones(2024)

  // January 2024 has 31 days
  assert.equal(months[0].date.getDate(), 31)
  // February 2024 (leap year) has 29 days
  assert.equal(months[1].date.getDate(), 29)
})

test('getMonthlyMilestones names each milestone with its full month and year', () => {
  const months = getMonthlyMilestones(2024)

  assert.equal(months[0].name, 'January 2024')
  assert.equal(months[11].name, 'December 2024')
})

// getGithub() memoizes one Octokit instance per target ('dev'/'production'/'docs') for the
// lifetime of the process, so grabbing the same instance here and mocking its methods with
// t.mock.method (auto-restored per test) reaches the exact object the tasks below call.
describe('github tasks (mocked Octokit/inquirer)', () => {
  let savedConfig
  let savedOptions

  beforeEach(() => {
    savedConfig = JSON.parse(JSON.stringify(sake.config))
    savedOptions = JSON.parse(JSON.stringify(sake.options))

    sake.config.deploy = {
      dev: { owner: 'devowner', name: 'dev-repo' },
      production: { owner: 'prodowner', name: 'prod-repo' }
    }
    sake.config.plugin = { id: 'my-plugin', name: 'My Plugin', version: { current: '1.0.0' }, changes: ['* Fix - something'] }
  })

  afterEach(() => {
    // see test/tasks/clean.test.js for why this must mutate in place
    for (const key of Object.keys(sake.config)) {
      delete sake.config[key]
    }
    Object.assign(sake.config, savedConfig)

    for (const key of Object.keys(sake.options)) {
      delete sake.options[key]
    }
    Object.assign(sake.options, savedOptions)
  })

  test('gitHubGetReleaseIssueTask completes without prompting when there are no open release issues', async (t) => {
    const gh = getGithub('dev')
    t.mock.method(gh.issues, 'listForRepo', async () => ({ data: [] }))
    t.mock.method(inquirer, 'prompt', async () => { throw new Error('inquirer.prompt should not have been called') })

    await new Promise((resolve) => gitHubGetReleaseIssueTask(resolve))
  })

  test('gitHubGetReleaseIssueTask records the selected issue number to close', async (t) => {
    const gh = getGithub('dev')
    t.mock.method(gh.issues, 'listForRepo', async () => ({
      data: [{ number: 42, html_url: 'http://x/42', pull_request: undefined }]
    }))
    t.mock.method(inquirer, 'prompt', async () => ({ issues_to_close: 42 }))

    await new Promise((resolve) => gitHubGetReleaseIssueTask(resolve))

    assert.equal(sake.options.release_issue_to_close, 42)
  })

  test('gitHubGetReleaseIssueTask leaves release_issue_to_close unset when "None" is chosen', async (t) => {
    const gh = getGithub('dev')
    t.mock.method(gh.issues, 'listForRepo', async () => ({
      data: [{ number: 42, html_url: 'http://x/42', pull_request: undefined }]
    }))
    t.mock.method(inquirer, 'prompt', async () => ({ issues_to_close: 'none' }))

    await new Promise((resolve) => gitHubGetReleaseIssueTask(resolve))

    assert.equal(sake.options.release_issue_to_close, undefined)
  })

  test('gitHubGetReleaseIssueTask\'s "None" choice has no label text', async (t) => {
    // bug: the choice is built as `name: 'None'.red` (tasks/github.js:60), a leftover from
    // some older "colors"-style String.prototype patching that isn't a dependency of this
    // project anymore - `'None'.red` is just `undefined` today, so the inquirer prompt
    // renders this choice with no visible label at all.
    const gh = getGithub('dev')
    t.mock.method(gh.issues, 'listForRepo', async () => ({
      data: [{ number: 42, html_url: 'http://x/42', pull_request: undefined }]
    }))

    let capturedChoices
    t.mock.method(inquirer, 'prompt', async (questions) => {
      capturedChoices = questions[0].choices()
      return { issues_to_close: 'none' }
    })

    await new Promise((resolve) => gitHubGetReleaseIssueTask(resolve))

    const noneChoice = capturedChoices.find((choice) => choice.value === 'none')
    assert.equal(noneChoice.name, undefined)
  })

  test('gitHubGetReleaseIssueTask completes without throwing when the GitHub API call rejects', async (t) => {
    const gh = getGithub('dev')
    t.mock.method(gh.issues, 'listForRepo', async () => { throw new Error('boom') })

    await assert.doesNotReject(() => new Promise((resolve) => gitHubGetReleaseIssueTask(resolve)))
  })

  test('gitHubGetWcIssuesTask skips the API call entirely when no production repo is configured', async (t) => {
    delete sake.config.deploy.production
    t.mock.method(inquirer, 'prompt', async () => { throw new Error('inquirer.prompt should not have been called') })

    await new Promise((resolve) => gitHubGetWcIssuesTask(resolve))
  })

  test('gitHubGetWcIssuesTask completes without prompting when there are no open issues', async (t) => {
    const gh = getGithub('production')
    t.mock.method(gh.issues, 'listForRepo', async () => ({ data: [] }))

    await new Promise((resolve) => gitHubGetWcIssuesTask(resolve))
  })

  test('gitHubCreateDocsIssueTask skips entirely when no docs repo is configured', async (t) => {
    t.mock.method(inquirer, 'prompt', async () => { throw new Error('inquirer.prompt should not have been called') })

    await new Promise((resolve) => gitHubCreateDocsIssueTask(resolve))
  })

  test('gitHubCreateDocsIssueTask creates no issue when the user declines', async (t) => {
    sake.config.deploy.docs = { owner: 'docsowner', name: 'docs-repo' }
    const gh = getGithub('docs')
    t.mock.method(inquirer, 'prompt', async () => ({ create_docs_issue: 0 }))
    t.mock.method(gh.issues, 'create', async () => { throw new Error('issues.create should not have been called') })

    await new Promise((resolve) => gitHubCreateDocsIssueTask(resolve))
  })

  test('gitHubCreateDocsIssueTask creates an issue with the plugin changelog when the user accepts', async (t) => {
    sake.config.deploy.docs = { owner: 'docsowner', name: 'docs-repo' }
    const gh = getGithub('docs')
    t.mock.method(inquirer, 'prompt', async () => ({ create_docs_issue: 1 }))

    let createCalledWith
    t.mock.method(gh.issues, 'create', async (opts) => {
      createCalledWith = opts
      return { data: { html_url: 'http://x' } }
    })

    await new Promise((resolve) => gitHubCreateDocsIssueTask(resolve))

    assert.equal(createCalledWith.owner, 'docsowner')
    assert.equal(createCalledWith.repo, 'docs-repo')
    assert.equal(createCalledWith.title, 'My Plugin: Updated to 1.0.0')
    assert.equal(createCalledWith.body, '* Fix - something')
  })

  test('gitHubCreateReleaseTask skips entirely when owner/repo are missing', async (t) => {
    sake.options.owner = undefined
    sake.options.repo = undefined
    const gh = getGithub('dev')
    t.mock.method(gh.repos, 'createRelease', async () => { throw new Error('createRelease should not have been called') })

    await new Promise((resolve) => gitHubCreateReleaseTask(resolve))
  })

  test('gitHubCreateReleaseTask creates a GitHub release and uploads the build zip', async (t) => {
    const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sake-gh-release-test-'))
    const savedCwd = process.cwd()
    fs.mkdirSync(path.join(scratchDir, 'build'), { recursive: true })
    fs.writeFileSync(path.join(scratchDir, 'build', 'my-plugin.1.0.0.zip'), 'zip contents')
    process.chdir(scratchDir)

    try {
      sake.config.paths = { build: 'build' }
      sake.options.owner = 'devowner'
      sake.options.repo = 'dev-repo'

      const gh = getGithub('dev')
      let uploadedName
      t.mock.method(gh.repos, 'createRelease', async () => ({
        data: { html_url: 'http://release', upload_url: 'http://upload' }
      }))
      t.mock.method(gh.repos, 'uploadReleaseAsset', async (opts) => {
        uploadedName = opts.name
        return {}
      })

      await new Promise((resolve) => gitHubCreateReleaseTask(resolve))

      assert.equal(sake.options.release_url, 'http://release')
      assert.equal(uploadedName, 'my-plugin.1.0.0.zip')
    } finally {
      process.chdir(savedCwd)
      fs.rmSync(scratchDir, { recursive: true, force: true })
    }
  })

  test('gitHubCreateReleaseTask reports a failed release creation via throwError, but never calls back', async (t) => {
    // bug: like createMilestones (see the dedicated test below), the `.catch()` on
    // `createRelease` (tasks/github.js:234-236) calls `sake.throwError(...)` and never
    // calls the series' per-task `cb` - so `gulp.series(tasks)(done)` never invokes `done`
    // and the task hangs forever. In real (non-mocked) usage this is worse than hanging:
    // `sake.throwError` actually throws synchronously, and that throw happens inside an
    // async `.catch` continuation with nothing above it to catch it - gulp/undertaker's
    // domain-based error handling intercepts it and re-throws fatally, crashing the whole
    // `sake` process with an `ERR_UNHANDLED_ERROR` instead of exiting cleanly with an error
    // message. Confirmed empirically; reproduced here with throwError mocked (non-throwing)
    // specifically to observe the "never calls back" half of the bug without also crashing
    // the test process.
    const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sake-gh-release-test-'))
    const savedCwd = process.cwd()
    fs.mkdirSync(path.join(scratchDir, 'build'), { recursive: true })
    // present so gitHubCreateReleaseTask skips queuing the (unregistered, in this test
    // context) gulp "zip" task and goes straight to the createRelease call under test
    fs.writeFileSync(path.join(scratchDir, 'build', 'my-plugin.1.0.0.zip'), 'zip contents')
    process.chdir(scratchDir)

    try {
      sake.config.paths = { build: 'build' }
      sake.options.owner = 'devowner'
      sake.options.repo = 'dev-repo'

      const gh = getGithub('dev')
      t.mock.method(gh.repos, 'createRelease', async () => { throw new Error('createRelease boom') })

      const thrownMessages = []
      t.mock.method(sake, 'throwError', (message) => { thrownMessages.push(message) })

      const STILL_PENDING = Symbol('still-pending')
      const result = await Promise.race([
        new Promise((resolve) => gitHubCreateReleaseTask(resolve)),
        new Promise((resolve) => setTimeout(() => resolve(STILL_PENDING), 200))
      ])

      assert.equal(result, STILL_PENDING)
      assert.equal(thrownMessages.length, 1)
      assert.match(thrownMessages[0], /Creating GH release failed: Error: createRelease boom/)
    } finally {
      process.chdir(savedCwd)
      fs.rmSync(scratchDir, { recursive: true, force: true })
    }
  })

  test('gitHubCreateReleaseMilestonesTask creates one milestone per Tuesday of the given year', async (t) => {
    sake.options.year = 2024

    const gh = getGithub('dev')
    const createdTitles = []
    t.mock.method(gh.issues, 'createMilestone', async (opts) => {
      createdTitles.push(opts.title)
      return {}
    })

    const result = await new Promise((resolve) => gitHubCreateReleaseMilestonesTask(resolve))

    assert.equal(result, null)
    assert.equal(createdTitles.length, 53)
  })

  test('gitHubCreateMonthMilestonesTask creates one milestone per month of the given year', async (t) => {
    sake.options.year = 2024

    const gh = getGithub('dev')
    const createdTitles = []
    t.mock.method(gh.issues, 'createMilestone', async (opts) => {
      createdTitles.push(opts.title)
      return {}
    })

    const result = await new Promise((resolve) => gitHubCreateMonthMilestonesTask(resolve))

    assert.equal(result, null)
    assert.equal(createdTitles.length, 12)
  })

  test('gitHubCreateReleaseMilestonesTask never calls back if a milestone creation fails', async (t) => {
    // bug: createMilestones' per-item error handler (tasks/github.js:318-327) only logs the
    // error - it never calls the async.eachLimit per-item `cb`. async's concurrency limit
    // (5) means that once 5 items are "stuck" waiting on a cb that will never come, the
    // queue can make no further progress: no more milestones are attempted, and the task's
    // own `done` callback (passed through as async.eachLimit's final callback) never fires.
    // In real usage this means a single failed milestone creation (e.g. a transient GitHub
    // API error) hangs the whole task indefinitely instead of failing loudly.
    sake.options.year = 2024

    const gh = getGithub('dev')
    let callCount = 0
    t.mock.method(gh.issues, 'createMilestone', async () => {
      callCount++
      throw new Error('milestone boom')
    })

    const STILL_PENDING = Symbol('still-pending')
    const result = await Promise.race([
      new Promise((resolve) => gitHubCreateReleaseMilestonesTask(resolve)),
      new Promise((resolve) => setTimeout(() => resolve(STILL_PENDING), 200))
    ])

    assert.equal(result, STILL_PENDING)
    // only 5 of the 53 Tuesdays were ever attempted - the concurrency limit, exhausted by
    // callbacks that never fire, blocks all further progress
    assert.equal(callCount, 5)
  })
})
