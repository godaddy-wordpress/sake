import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import shell from 'shelljs'
import sake from '../../lib/sake.js'
import {
  shellUpdateFrameworkTask,
  shellUpdateFrameworkCommitTask,
  shellGitEnsureCleanWorkingCopyTask,
  shellGitPushUpdateTask,
  shellGitPullWcRepoTask,
  shellGitPushWcRepoTask,
  shellGitUpdateWcRepoTask,
  shellGitStashTask,
  shellGitStashApplyTask,
  shellComposerStatusTask,
  shellComposerInstallTask,
  shellComposerUpdateTask,
  shellSvnCheckoutTask,
  shellSvnCommitTrunkTask,
  shellSvnCommitTagTask,
  shellSvnCommitAssetsTask
} from '../../tasks/shell.js'

// matches tasks/shell.js's own module-level constants, computed from process.platform at
// import time - tests build expected command strings the same way so they pass regardless
// of which platform they run on (local macOS dev vs. ubuntu-latest in CI)
const awk = process.platform === 'win32' ? 'gawk' : 'awk'
const noRunIfEmpty = process.platform !== 'darwin' ? '--no-run-if-empty ' : ''

// mocks shell.exec against every call shape used across tasks/shell.js: `exec(cmd, cb)`,
// `exec(cmd, opts, cb)`, and the direct, callback-less `shell.exec(cmd)` sync-style call
// used elsewhere (tasks/makepot.js). `impl` may return `{code, stdout, stderr}` for a given
// command, or default to `{code: 0}`.
const mockShellExec = (t, impl = () => ({ code: 0 })) => {
  const calls = []

  t.mock.method(shell, 'exec', (command, optsOrCallback, maybeCallback) => {
    calls.push(command)
    const result = impl(command) || { code: 0 }
    const callback = typeof optsOrCallback === 'function' ? optsOrCallback : maybeCallback

    if (callback) callback(result.code ?? 0, result.stdout ?? '', result.stderr ?? '')

    return result
  })

  return calls
}

let scratchDir
let savedCwd
let savedConfig
let savedOptions

beforeEach(() => {
  scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sake-shell-test-'))
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

test('shellUpdateFrameworkTask throws when the plugin has no framework configured', () => {
  sake.config.framework = false

  assert.throws(() => shellUpdateFrameworkTask(() => {}), /Not a frameworked plugin, aborting/)
})

test('shellUpdateFrameworkTask runs a git subtree pull when the v4 framework path exists', async (t) => {
  sake.config.framework = 'v4'
  sake.config.paths = { src: '.', framework: { base: 'lib/skyverge/wc-plugin-framework' } }
  sake.config.multiPluginRepo = false
  sake.options.branch = 'legacy-v4'
  fs.mkdirSync('lib/skyverge/wc-plugin-framework', { recursive: true })

  const calls = mockShellExec(t)

  await new Promise((resolve) => shellUpdateFrameworkTask(resolve))

  assert.equal(calls.length, 1)
  assert.equal(calls[0], 'git fetch wc-plugin-framework legacy-v4 && git status && git subtree pull --prefix lib/skyverge/wc-plugin-framework wc-plugin-framework legacy-v4 --squash && echo subtree up to date!')
})

test('shellUpdateFrameworkTask prefixes the subtree path and cds up a directory for multi-plugin repos', async (t) => {
  sake.config.framework = 'v4'
  sake.config.paths = { src: '.', framework: { base: 'lib/skyverge/wc-plugin-framework' } }
  sake.config.multiPluginRepo = true
  sake.config.plugin = { id: 'my-plugin' }
  fs.mkdirSync('lib/skyverge/wc-plugin-framework', { recursive: true })

  const calls = mockShellExec(t)

  await new Promise((resolve) => shellUpdateFrameworkTask(resolve))

  assert.match(calls[0], /^cd \.\.\/ && /)
  assert.match(calls[0], /--prefix my-plugin\/lib\/skyverge\/wc-plugin-framework /)
})

test('shellUpdateFrameworkTask is a no-op when the v4 framework path does not exist', async (t) => {
  sake.config.framework = 'v4'
  sake.config.paths = { src: '.', framework: { base: 'lib/skyverge/wc-plugin-framework' } }

  const calls = mockShellExec(t)

  await new Promise((resolve) => shellUpdateFrameworkTask(resolve))

  assert.deepEqual(calls, ['echo no subtree to update'])
})

test('shellUpdateFrameworkCommitTask commits a framework version bump when the framework path exists', async (t) => {
  sake.config.paths = { src: '.', framework: { base: 'lib/skyverge/wc-plugin-framework' } }
  sake.config.plugin = { name: 'My Plugin', frameworkVersion: '5.14.0' }
  fs.mkdirSync('lib/skyverge/wc-plugin-framework', { recursive: true })

  const calls = mockShellExec(t)

  await new Promise((resolve) => shellUpdateFrameworkCommitTask(resolve))

  assert.deepEqual(calls, ['git add -A && git diff-index --quiet --cached HEAD || git commit -m "My Plugin: Update framework to v5.14.0"'])
})

test('shellUpdateFrameworkCommitTask passes an unjoined array (not a command string) to shell.exec when the framework path does not exist', async (t) => {
  // bug: tasks/shell.js:76-79 builds this branch's `command` as an array but - unlike
  // every other branch in this file - never calls `.join(' && ')` on it before passing it
  // to `exec()`/`shell.exec()`, which expect a string. Passing an array here is invalid:
  // Node's child_process (which shelljs delegates to) throws
  // `TypeError [ERR_INVALID_ARG_TYPE]: The "command" argument must be of type string` when
  // given a non-string command - confirmed empirically outside this test. So in real
  // (non-mocked) usage this branch doesn't run the intended "git add -A && git commit"
  // sequence at all. Documenting the actual (buggy) call rather than the evidently
  // intended one.
  sake.config.paths = { src: '.', framework: { base: 'lib/skyverge/wc-plugin-framework' } }
  sake.config.plugin = { name: 'My Plugin' }

  const calls = mockShellExec(t)

  await new Promise((resolve) => shellUpdateFrameworkCommitTask(resolve))

  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0], [
    'git add -A',
    'git diff-index --quiet --cached HEAD || git commit -m "My Plugin: Update readme.txt"'
  ])
})

test('shellGitEnsureCleanWorkingCopyTask completes without error when the working copy is clean', async (t) => {
  mockShellExec(t, () => ({ code: 0 }))

  await new Promise((resolve) => shellGitEnsureCleanWorkingCopyTask(resolve))
})

test('shellGitEnsureCleanWorkingCopyTask reports a dirty working copy via throwError and never calls back', async (t) => {
  // not a bug like the others documented elsewhere: sake.throwError() throws synchronously
  // by design here, intentionally crashing the process on a dirty working copy as a hard
  // deploy-safety check - there's no "done" path to reach in real usage either. Mocking
  // throwError to record instead of throw (so we can observe the message without actually
  // crashing the test process) means done is simply never called in this test either -
  // hence the race-with-timeout, same technique used elsewhere for cases that don't call
  // back.
  const thrownMessages = []
  t.mock.method(sake, 'throwError', (message) => { thrownMessages.push(message) })
  mockShellExec(t, (command) => ({ code: command.includes('diff-index') ? 1 : 0 }))

  const STILL_PENDING = Symbol('still-pending')
  const result = await Promise.race([
    new Promise((resolve) => shellGitEnsureCleanWorkingCopyTask(resolve)),
    new Promise((resolve) => setTimeout(() => resolve(STILL_PENDING), 200))
  ])

  assert.equal(result, STILL_PENDING)
  assert.deepEqual(thrownMessages, ['Working copy is not clean!'])
})

test('shellGitPushUpdateTask builds a commit+push command, closing an issue when one is queued', async (t) => {
  sake.config.plugin = { name: 'My Plugin', version: { current: '1.0.0' } }
  sake.options.release_issue_to_close = 42

  const calls = mockShellExec(t)

  await new Promise((resolve) => shellGitPushUpdateTask(resolve))

  assert.deepEqual(calls, ['git add -A && git commit -m "My Plugin: 1.0.0 Versioning" -m "Closes #42" && git push && echo git up to date!'])
})

test('shellGitPushUpdateTask omits the issue-closing message when none is queued', async (t) => {
  sake.config.plugin = { name: 'My Plugin', version: { current: '1.0.0' } }
  delete sake.options.release_issue_to_close

  const calls = mockShellExec(t)

  await new Promise((resolve) => shellGitPushUpdateTask(resolve))

  assert.deepEqual(calls, ['git add -A && git commit -m "My Plugin: 1.0.0 Versioning" && git push && echo git up to date!'])
})

test('shellGitPullWcRepoTask clones the repo when the production repo path does not exist yet', async (t) => {
  sake.config.paths = { tmp: path.join(scratchDir, 'tmp') }
  sake.config.deploy = { production: { name: 'my-repo', url: 'git@example.com:owner/repo.git' } }

  const calls = mockShellExec(t)

  await new Promise((resolve) => shellGitPullWcRepoTask(resolve))

  assert.deepEqual(calls, [`cd ${sake.config.paths.tmp} && git clone git@example.com:owner/repo.git`])
  assert.ok(fs.existsSync(sake.config.paths.tmp))
})

test('shellGitPullWcRepoTask pulls and pushes when the production repo path already exists', async (t) => {
  const tmp = path.join(scratchDir, 'tmp')
  const repoName = 'my-repo'
  fs.mkdirSync(path.join(tmp, repoName), { recursive: true })
  sake.config.paths = { tmp }
  sake.config.deploy = { production: { name: repoName, url: 'git@example.com:owner/repo.git' } }

  const calls = mockShellExec(t)

  await new Promise((resolve) => shellGitPullWcRepoTask(resolve))

  assert.deepEqual(calls, [`cd ${path.join(tmp, repoName)} && git pull && git push`])
})

test('shellGitPullWcRepoTask ignores the "missing ref" error on an empty remote repo', async (t) => {
  const tmp = path.join(scratchDir, 'tmp')
  sake.config.paths = { tmp }
  sake.config.deploy = { production: { name: 'my-repo', url: 'git@example.com:owner/repo.git' } }

  mockShellExec(t, () => ({ code: 1, stderr: 'Your configuration specifies to merge with the ref ...' }))

  await assert.doesNotReject(() => new Promise((resolve, reject) => {
    shellGitPullWcRepoTask((err) => (err ? reject(err) : resolve()))
  }))
})

test('shellGitPullWcRepoTask reports any other failure', async (t) => {
  const tmp = path.join(scratchDir, 'tmp')
  sake.config.paths = { tmp }
  sake.config.deploy = { production: { name: 'my-repo', url: 'git@example.com:owner/repo.git' } }

  mockShellExec(t, () => ({ code: 1, stderr: 'fatal: unrelated error' }))

  await assert.rejects(
    () => new Promise((resolve, reject) => {
      shellGitPullWcRepoTask((err) => (err ? reject(err) : resolve()))
    }),
    /Command failed/
  )
})

test('shellGitPushWcRepoTask always throws, since it refers to a gulp task name that was never registered', () => {
  // bug: tasks/shell.js:169 calls `gulp.series('shell:git_pull_wc_repo')`, passing the
  // *string* name of shellGitPullWcRepoTask's displayName rather than the function
  // reference itself. gulp/undertaker only resolves a string task name against tasks
  // explicitly registered via `gulp.task(name, fn)` - nothing in this codebase ever
  // registers a task under that name (displayName alone doesn't register it) - so
  // `gulp.series(...)` throws "Task never defined: shell:git_pull_wc_repo" synchronously,
  // every single time this (already @deprecated) task is called, before it ever gets a
  // chance to run the pull or build its own commit/push command.
  sake.config.plugin = { name: 'My Plugin' }
  sake.config.deploy = { production: {} }
  sake.options.wc_issues_to_close = [1, 2]

  assert.throws(() => shellGitPushWcRepoTask(() => {}), /Task never defined: shell:git_pull_wc_repo/)
})

test('shellGitUpdateWcRepoTask builds a pull+commit+push command for the production repo', async (t) => {
  const tmp = path.join(scratchDir, 'tmp')
  const repoName = 'my-repo'
  sake.config.paths = { tmp }
  sake.config.deploy = { production: { name: repoName } }
  sake.config.plugin = { name: 'My Plugin' }

  const calls = mockShellExec(t)

  await new Promise((resolve) => shellGitUpdateWcRepoTask(resolve))

  assert.deepEqual(calls, [
    `cd ${path.join(tmp, repoName)} && git pull && git add -A && git diff-index --quiet --cached HEAD || git commit -m "Updating My Plugin" && git push && echo WooCommerce repo up to date!`
  ])
})

test('shellGitStashTask stashes uncommitted changes', async (t) => {
  const calls = mockShellExec(t)

  await new Promise((resolve) => shellGitStashTask(resolve))

  assert.deepEqual(calls, ['git stash'])
})

test('shellGitStashApplyTask applies the latest stash', async (t) => {
  const calls = mockShellExec(t)

  await new Promise((resolve) => shellGitStashApplyTask(resolve))

  assert.deepEqual(calls, ['git stash apply'])
})

for (const [taskName, task, command] of [
  ['shellComposerStatusTask', shellComposerStatusTask, 'composer status -v'],
  ['shellComposerInstallTask', shellComposerInstallTask, 'composer install --no-dev'],
  ['shellComposerUpdateTask', shellComposerUpdateTask, 'composer update --no-dev']
]) {
  test(`${taskName} runs "${command}" when composer.json exists`, async (t) => {
    fs.writeFileSync('composer.json', '{}')

    const calls = mockShellExec(t)

    await new Promise((resolve) => task(resolve))

    assert.deepEqual(calls, [command])
  })

  test(`${taskName} is a no-op when composer.json does not exist`, async (t) => {
    const calls = mockShellExec(t)

    await new Promise((resolve) => task(resolve))

    assert.deepEqual(calls, [])
  })
}

test('shellSvnCheckoutTask checks out the production SVN repo, creating the tmp dir if needed', async (t) => {
  const tmp = path.join(scratchDir, 'tmp')
  const repoName = 'my-repo'
  sake.config.paths = { tmp }
  sake.config.deploy = { production: { name: repoName, url: 'https://plugins.svn.wordpress.org/my-plugin' } }

  const calls = mockShellExec(t)

  await new Promise((resolve) => shellSvnCheckoutTask(resolve))

  assert.deepEqual(calls, [`svn co --force-interactive https://plugins.svn.wordpress.org/my-plugin ${path.join(tmp, repoName)}`])
  assert.ok(fs.existsSync(tmp))
})

test('shellSvnCommitTrunkTask adds/deletes changed trunk files and commits', async (t) => {
  const tmp = path.join(scratchDir, 'tmp')
  const repoName = 'my-repo'
  sake.config.paths = { tmp }
  sake.config.deploy = { production: { name: repoName, user: 'svnuser' } }
  sake.config.plugin = { version: { current: '1.2.3' } }

  const calls = mockShellExec(t)

  await new Promise((resolve) => shellSvnCommitTrunkTask(resolve))

  const trunkDir = path.join(tmp, repoName, 'trunk')
  assert.deepEqual(calls, [
    `cd ${trunkDir} && svn status | ${awk} '/^[?]/{print $2}' | xargs ${noRunIfEmpty}svn add && svn status | ${awk} '/^[!]/{print $2}' | xargs ${noRunIfEmpty}svn delete && svn commit --force-interactive --username="svnuser" -m "Committing 1.2.3 to trunk"`
  ])
})

test('shellSvnCommitTagTask adds and commits the tag directory', async (t) => {
  const tmp = path.join(scratchDir, 'tmp')
  const repoName = 'my-repo'
  sake.config.paths = { tmp }
  sake.config.deploy = { production: { name: repoName, user: 'svnuser' } }
  sake.config.plugin = { version: { current: '1.2.3' } }

  const calls = mockShellExec(t)

  await new Promise((resolve) => shellSvnCommitTagTask(resolve))

  const tagDir = path.join(tmp, repoName, 'tags', '1.2.3')
  assert.deepEqual(calls, [
    `cd ${tagDir} && svn add . && svn commit --force-interactive --username="svnuser" -m "Tagging 1.2.3"`
  ])
})

test('shellSvnCommitAssetsTask sets mime types, adds/deletes changed assets, and commits', async (t) => {
  const tmp = path.join(scratchDir, 'tmp')
  const repoName = 'my-repo'
  sake.config.paths = { tmp }
  sake.config.deploy = { production: { name: repoName, user: 'svnuser' } }
  sake.config.plugin = { version: { current: '1.2.3' } }

  const calls = mockShellExec(t)

  await new Promise((resolve) => shellSvnCommitAssetsTask(resolve))

  const assetsDir = path.join(tmp, repoName, 'assets')
  assert.deepEqual(calls, [
    `cd ${assetsDir} && svn status | ${awk} '/^[?]/{print $2}' | xargs ${noRunIfEmpty}svn add && ` +
    'if ls *.png >/dev/null 2>&1; then svn propset svn:mime-type image/png *.png; fi && ' +
    'if ls *.jpg >/dev/null 2>&1; then svn propset svn:mime-type image/jpeg *.jpg; fi && ' +
    `svn status | ${awk} '/^[!]/{print $2}' | xargs ${noRunIfEmpty}svn delete && ` +
    'svn commit --force-interactive --username="svnuser" -m "Committing assets for 1.2.3"'
  ])
})
