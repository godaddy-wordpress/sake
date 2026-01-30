import fs from 'node:fs'
import path from 'node:path'
import log from 'fancy-log'
import shell from 'shelljs'
import _str from 'underscore.string'
import sake from '../lib/sake.js'
import gulp from 'gulp'

const awk = process.platform === 'win32' ? 'gawk' : 'awk'
const noRunIfEmpty = process.platform !== 'darwin' ? '--no-run-if-empty ' : ''

// run a shell command, preserving output and failing the task on errors
const exec = (command, opts, done) => {
  log.info('$ ' + command)

  if (typeof opts === 'function') {
    done = opts
    opts = {}
  }

  shell.exec(command, opts, (code) => done(code > 0 ? 'Command failed [exit code ' + code + ']: ' + command : null))
}

/**
 * Update framework subtree
 */
const shellUpdateFrameworkTask = (done) => {
  if (!sake.config.framework) {
    sake.throwError('Not a frameworked plugin, aborting')
  }

  let command = ''

  if (sake.config.framework === 'v4') {
    let frameworkPath = path.join(process.cwd(), sake.config.paths.src, sake.config.paths.framework.base)

    if (fs.existsSync(frameworkPath)) {
      let branch = sake.options.branch || 'legacy-v4'
      let prefix = path.join((sake.config.multiPluginRepo ? sake.config.plugin.id : '.'), sake.config.paths.framework.base)

      command = [
        'git fetch wc-plugin-framework ' + branch,
        'git status',
        'git subtree pull --prefix ' + prefix + ' wc-plugin-framework ' + branch + ' --squash',
        'echo subtree up to date!'
      ]

      if (sake.config.multiPluginRepo) {
        command.unshift('cd ../')
      }

      command = command.join(' && ')
    } else {
      command = 'echo no subtree to update'
    }
  }

  exec(command, done)
}
shellUpdateFrameworkTask.displayName = 'shell:update_framework'

/**
 * Commit framework update
 */
const shellUpdateFrameworkCommitTask = (done) => {
  let frameworkPath = path.join(process.cwd(), sake.config.paths.src, sake.config.paths.framework.base)
  let command = ''

  if (fs.existsSync(frameworkPath)) {
    command = [
      'git add -A',
      'git diff-index --quiet --cached HEAD || git commit -m "' + sake.config.plugin.name + ': Update framework to v' + sake.config.plugin.frameworkVersion + '"'
    ].join(' && ')
  } else {
    // TODO: is this still necessary? {IT 2018-03-21}
    command = [
      'git add -A',
      'git diff-index --quiet --cached HEAD || git commit -m "' + sake.config.plugin.name + ': Update readme.txt"'
    ]
  }

  exec(command, done)
}
shellUpdateFrameworkCommitTask.displayName = 'shell:update_framework_commit'

/**
 * Ensure the working copy (git tree) has no uncommitted changes
 */
const shellGitEnsureCleanWorkingCopyTask = (done) => {
  let command = [
    'git diff-index --quiet HEAD'
  ].join(' && ')

  shell.exec(command, (code) => {
    if (!code) return done()

    shell.exec('git status', () => {
      sake.throwError('Working copy is not clean!')
    })
  })
}
shellGitEnsureCleanWorkingCopyTask.displayName = 'shell:git_ensure_clean_working_copy'

/**
 * Commit and push update
 */
const shellGitPushUpdateTask = (done) => {
  const command = [
    'git add -A',
    'git commit -m "' + sake.config.plugin.name + ': ' + sake.getPluginVersion() + ' Versioning"' + (sake.options.release_issue_to_close ? ' -m "Closes #' + sake.options.release_issue_to_close + '"' : ''),
    'git push',
    'echo git up to date!'
  ].join(' && ')

  exec(command, done)
}
shellGitPushUpdateTask.displayName = 'shell:git_push_update'

/**
 * Pull updates from WC repo, or clone repo, if deploying for the first time
 * @deprecated We no longer use WC mirror repos
 */
const shellGitPullWcRepoTask = (done) => {
  let command = []

  if (!fs.existsSync(sake.getProductionRepoPath())) {
    // ensure that the tmp dir exists
    if (!fs.existsSync(sake.config.paths.tmp)) {
      shell.mkdir('-p', sake.config.paths.tmp)
    }

    // repo does not exist yet
    command = [
      'cd ' + sake.config.paths.tmp,
      'git clone ' + sake.config.deploy.production.url
    ]
  } else {
    // repo already exists
    command = [
      'cd ' + sake.getProductionRepoPath(),
      'git pull && git push'
    ]
  }

  shell.exec(command.join(' && '), (code, stdout, stderr) => {
    // ignore missing ref error - this will happen when the remote repo is empty (for example, a new WC plugin)
    // and we try to `git pull`
    if (code === 1 && stderr.indexOf('Your configuration specifies to merge with the ref') > -1) {
      return done()
    } else {
      return done(code > 0 ? 'Command failed [exit code ' + code + ']: ' + command : null)
    }
  })
}
shellGitPullWcRepoTask.displayName = 'shell:git_pull_wc_repo'

/**
 * Commit and push update to WC repo
 * @deprecated We no longer use WC mirror repos
 */
const shellGitPushWcRepoTask = (done) => {
  let closeIssues = ''

  if (sake.options.wc_issues_to_close) {
    closeIssues = ' -m "' + _str.capitalize(sake.options.wc_issues_to_close.map((issue) => `closes #${issue}`).join(', ')) + '"'
  }

  // always ensure to pull the repo, but bypass the missing ref error
  gulp.series('shell:git_pull_wc_repo')((err) => {
    if (err) sake.throwError(err)

    let command = [
      'cd ' + sake.getProductionRepoPath(),
      'git add -A',
      'git commit -m "Update ' + sake.config.plugin.name + ' to ' + sake.getPluginVersion() + '"' + closeIssues,
      'git push'
    ].join(' && ')

    exec(command, done)
  })
}
shellGitPushWcRepoTask.displayName = 'shell:git_push_wc_repo'

/**
 * Commit and push update to WC repo, version 2
 * @deprecated We no longer use WooCommerce mirror repos
 */
const shellGitUpdateWcRepoTask = (done) => {
  let command = [
    'cd ' + sake.getProductionRepoPath(),
    'git pull',
    'git add -A',
    'git diff-index --quiet --cached HEAD || git commit -m "Updating ' + sake.config.plugin.name + '"',
    'git push',
    'echo WooCommerce repo up to date!'
  ].join(' && ')

  exec(command, done)
}
shellGitUpdateWcRepoTask.displayName = 'shell:git_update_wc_repo'

/**
 * Stash uncommitted changes
 */
const shellGitStashTask = (done) => {
  exec('git stash', done)
}
shellGitStashTask.displayName = 'shell:git_stash'

/**
 * Apply latest stash
 */
const shellGitStashApplyTask = (done) => {
  exec('git stash apply', done)
}
shellGitStashApplyTask.displayName = 'shell:git_stash_apply'

const shellComposerStatusTask = (done) => {
  if (fs.existsSync(path.join(process.cwd(), 'composer.json'))) {
    exec('composer status -v', done)
  } else {
    log.info('No composer.json found, skipping composer status')
    done()
  }
}
shellComposerStatusTask.displayName = 'shell:composer_status'

const shellComposerInstallTask = (done) => {
  if (fs.existsSync(path.join(process.cwd(), 'composer.json'))) {
    exec('composer install --no-dev', done)
  } else {
    log.info('No composer.json found, skipping composer install')
    done()
  }
}
shellComposerInstallTask.displayName = 'shell:composer_install'

const shellComposerUpdateTask = (done) => {
  if (fs.existsSync(path.join(process.cwd(), 'composer.json'))) {
    exec('composer update --no-dev', done)
  } else {
    log.info('No composer.json found, skipping composer update')
    done()
  }
}
shellComposerUpdateTask.displayName = 'shell:composer_update'

const shellSvnCheckoutTask = (done) => {
  // ensure that the tmp dir exists
  if (!fs.existsSync(sake.config.paths.tmp)) {
    shell.mkdir('-p', sake.config.paths.tmp)
  }

  let command = 'svn co --force-interactive ' + sake.config.deploy.production.url + ' ' + sake.getProductionRepoPath()

  exec(command, done)
}
shellSvnCheckoutTask.displayName = 'shell:svn_checkout'

const shellSvnCommitTrunkTask = (done) => {
  const commitMsg = 'Committing ' + sake.getPluginVersion() + ' to trunk'

  let command = [
    'cd ' + path.join(sake.getProductionRepoPath(), 'trunk'),
    'svn status | ' + awk + " '/^[?]/{print $2}' | xargs " + noRunIfEmpty + 'svn add',
    'svn status | ' + awk + " '/^[!]/{print $2}' | xargs " + noRunIfEmpty + 'svn delete',
    'svn commit --force-interactive --username="' + sake.config.deploy.production.user + '" -m "' + commitMsg + '"'
  ].join(' && ')

  exec(command, done)
}
shellSvnCommitTrunkTask.displayName = 'shell:svn_commit_trunk'

const shellSvnCommitTagTask = (done) => {
  const commitMsg = 'Tagging ' + sake.getPluginVersion()

  let command = [
    'cd ' + path.join(sake.getProductionRepoPath(), 'tags', sake.getPluginVersion()),
    'svn add .',
    'svn commit --force-interactive --username="' + sake.config.deploy.production.user + '" -m "' + commitMsg + '"'
  ].join(' && ')

  exec(command, done)
}
shellSvnCommitTagTask.displayName = 'shell:svn_commit_tag'

const shellSvnCommitAssetsTask = (done) => {
  const commitMsg = 'Committing assets for ' + sake.getPluginVersion()

  let command = [
    'cd ' + path.join(sake.getProductionRepoPath(), 'assets'),
    'svn status | ' + awk + " '/^[?]/{print $2}' | xargs " + noRunIfEmpty + 'svn add',
    'svn status | ' + awk + " '/^[!]/{print $2}' | xargs " + noRunIfEmpty + 'svn delete',
    'svn commit --force-interactive --username="' + sake.config.deploy.production.user + '" -m "' + commitMsg + '"'
  ].join(' && ')

  exec(command, done)
}
shellSvnCommitAssetsTask.displayName = 'shell:svn_commit_assets'

export {
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
}
