const fs = require('fs')
const path = require('path')
const log = require('fancy-log')
const shell = require('shelljs')
const _str = require('underscore.string')

module.exports = (gulp, config, plugins, options) => {
  const util = require('../lib/utilities')(config, options)
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

  // update framework subtree
  gulp.task('shell:update_framework', (done) => {
    if (!config.framework) {
      let err = new Error('Not a frameworked plugin, aborting')
      err.showStack = false
      throw err
    }

    let command = ''

    if (config.framework === 'v4') {
      let frameworkPath = path.join(process.cwd(), config.paths.src, config.paths.framework.base)

      if (fs.existsSync(frameworkPath)) {
        let branch = options.branch || 'legacy-v4'
        let prefix = path.join((config.multiPluginRepo ? config.plugin.id : '.'), config.paths.framework.base)

        command = [
          'git fetch wc-plugin-framework ' + branch,
          'git status',
          'git subtree pull --prefix ' + prefix + ' wc-plugin-framework ' + branch + ' --squash',
          'echo subtree up to date!'
        ]

        if (config.multiPluginRepo) {
          command.unshift('cd ../')
        }

        command = command.join(' && ')
      } else {
        command = 'echo no subtree to update'
      }
    }

    exec(command, done)
  })

  // commit framework update
  gulp.task('shell:update_framework_commit', (done) => {
    let frameworkPath = path.join(process.cwd(), config.paths.src, config.paths.framework.base)
    let command = ''

    if (fs.existsSync(frameworkPath)) {
      command = [
        'git add -A',
        'git diff-index --quiet --cached HEAD || git commit -m "' + config.plugin.name + ': Update framework to v' + config.plugin.frameworkVersion + '"'
      ].join(' && ')
    } else {
      // TODO: is this still necessary? {IT 2018-03-21}
      command = [
        'git add -A',
        'git diff-index --quiet --cached HEAD || git commit -m "' + config.plugin.name + ': Update readme.txt"'
      ]
    }

    exec(command, done)
  })

  // ensure the working copy (git tree) has no uncommited changes
  gulp.task('shell:git_ensure_clean_working_copy', (done) => {
    let command = [
      'git diff-index --quiet HEAD --'
    ].join(' && ')

    shell.exec(command, (code) => {
      if (!code) return done()

      shell.exec('git status', () => {
        let err = new Error('Working copy is not clean!')
        err.showStack = false
        done(err)
      })
    })
  })

  // commit and push update
  gulp.task('shell:git_push_update', (done) => {
    let command = [
      'git add -A',
      'git commit -m "' + config.plugin.name + ': ' + util.getVersionBump() + ' Versioning"' + (options.release_issue_to_close ? ' -m "Closes #' + options.release_issue_to_close + '"' : ''),
      'git push',
      'echo git up to date!'
    ].join(' && ')

    exec(command, done)
  })

  // pull updates from WC repo, or clone repo, if deploying for the first time
  gulp.task('shell:git_pull_wc_repo', (done) => {
    let command = []

    if (!fs.existsSync(util.getProductionRepoPath())) {
      // ensure that the tmp dir exists
      if (!fs.existsSync(config.paths.tmp)) {
        shell.mkdir('-p', config.paths.tmp)
      }

      // repo does not exist yet
      command = [
        'cd ' + config.paths.tmp,
        'git clone ' + config.deploy.production.url
      ]
    } else {
      // repo already exists
      command = [
        'cd ' + util.getProductionRepoPath(),
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
  })

  // commit and push update to WC repo
  gulp.task('shell:git_push_wc_repo', (done) => {
    let closeIssues = ''

    if (options.wc_issues_to_close) {
      closeIssues = ' -m "' + _str.capitalize(options.wc_issues_to_close.map((issue) => `closes #${issue}`).join(', ')) + '"'
    }

    // always ensure to pull the repo, but bypass the missing ref error
    gulp.series('shell:git_pull_wc_repo')((err) => {
      if (err) return done(err)

      let command = [
        'cd ' + util.getProductionRepoPath(),
        'git add -A',
        'git commit -m "Update ' + config.plugin.name + ' to ' + util.getVersionBump() + '"' + closeIssues,
        'git push'
      ].join(' && ')

      exec(command, done)
    })
  })

  // TODO: do we need this anymore?
  // commit and push update, ver 2
  gulp.task('shell:git_update_wc_repo', (done) => {
    let command = [
      'cd ' + util.getProductionRepoPath(),
      'git pull',
      'git add -A',
      'git diff-index --quiet --cached HEAD || git commit -m "Updating ' + config.plugin.name + '"',
      'git push',
      'echo WooCommerce repo up to date!'
    ].join(' && ')

    exec(command, done)
  })

  // stash uncommitted changes
  gulp.task('shell:git_stash', (done) => {
    exec('git stash', done)
  })

  // apply latest stash
  gulp.task('shell:git_stash_apply', (done) => {
    exec('git stash apply', done)
  })

  gulp.task('shell:composer_install', (done) => {
    if (fs.existsSync(path.join(process.cwd(), 'composer.json'))) {
      // unfortunately, adding --no-dev flag here will wipe out any existing dev packages :'(
      exec('composer install', done)
    } else {
      log.info('No composer.json found, skipping composer install')
      done()
    }
  })

  gulp.task('shell:composer_update', (done) => {
    if (fs.existsSync(path.join(process.cwd(), 'composer.json'))) {
      // unfortunately, adding --no-dev flag here will wipe out any existing dev packages :'(
      exec('composer update', done)
    } else {
      log.info('No composer.json found, skipping composer update')
      done()
    }
  })

  gulp.task('shell:svn_checkout', (done) => {
    // ensure that the tmp dir exists
    if (!fs.existsSync(config.paths.tmp)) {
      shell.mkdir('-p', config.paths.tmp)
    }

    let command = 'svn co --force-interactive ' + config.deploy.production.url + ' ' + util.getProductionRepoPath()

    exec(command, done)
  })

  gulp.task('shell:svn_commit_trunk', (done) => {
    const commitMsg = 'Committing ' + util.getPluginVersion() + ' to trunk'

    let command = [
      'cd ' + path.join(util.getProductionRepoPath(), 'trunk'),
      'svn status | ' + awk + " '/^[?]/{print $2}' | xargs " + noRunIfEmpty + 'svn add',
      'svn status | ' + awk + " '/^[!]/{print $2}' | xargs " + noRunIfEmpty + 'svn delete',
      'svn commit --force-interactive --username="' + config.deploy.production.user + '" -m "' + commitMsg + '"'
    ].join(' && ')

    exec(command, done)
  })

  gulp.task('shell:svn_commit_tag', (done) => {
    const commitMsg = 'Tagging ' + util.getPluginVersion()

    let command = [
      'cd ' + path.join(util.getProductionRepoPath(), 'tags', util.getPluginVersion()),
      'svn commit --force-interactive --username="' + config.deploy.production.user + '" -m "' + commitMsg + '"'
    ].join(' && ')

    exec(command, done)
  })

  gulp.task('shell:svn_commit_assets', (done) => {
    const commitMsg = 'Committing assets for ' + util.getPluginVersion()

    let command = [
      'cd ' + path.join(util.getProductionRepoPath(), 'assets'),
      'svn status | ' + awk + " '/^[?]/{print $2}' | xargs " + noRunIfEmpty + 'svn add',
      'svn status | ' + awk + " '/^[!]/{print $2}' | xargs " + noRunIfEmpty + 'svn delete',
      'svn commit --force-interactive --username="' + config.deploy.production.user + '" -m "' + commitMsg + '"'
    ].join(' && ')

    exec(command, done)
  })
}
