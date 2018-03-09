const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

// TODO: add support for FW v5

module.exports = (gulp, config, plugins, options) => {
  // run a shell command, preserving output and failing the task on errors
  const exec = (command, cb) => {
    spawn(command, { stdio: 'inherit', shell: true }).on('exit', (code) => cb(code > 0 ? 'Command failed [exit code ' + code + ']: ' + command : null))
  }

  // update framework subtree
  gulp.task('shell:update_framework', (cb) => {
    let frameworkPath = path.join(process.cwd(), config.paths.src, config.paths.framework.base)
    let command = ''

    if (fs.existsSync(frameworkPath)) {
      let branch = options.branch || 'master'

      command = [
        'git fetch wc-plugin-framework ' + branch,
        'git status',
        // 'git subtree pull --prefix ' + 'lib/skyverge wc-plugin-framework ' + branch + ' --squash',
        'echo subtree up to date!'
      ].join(' && ')
    } else {
      command = 'echo no subtree to update'
    }

    exec(command, cb)
  })

  // commit framework update
  gulp.task('shell:update_framework_commit', (cb) => {
    let frameworkPath = path.join(process.cwd(), config.paths.src, config.paths.framework.base)
    let command = ''

    if (fs.existsSync(frameworkPath)) {
      command = [
        'git add -A',
        'git diff-index --quiet --cached HEAD || git commit -m "' + config.plugin.name + ': Update framework to v' + config.plugin.frameworkVersion + '"'
      ].join(' && ')
    } else {
      command = [
        'git add -A',
        'git diff-index --quiet --cached HEAD || git commit -m "' + config.pluginname + ': Update readme.txt"'
      ]
    }

    exec(command, cb)
  })

  // commit framework update
  gulp.task('shell:update_framework_commit', (cb) => {
    let frameworkPath = path.join(process.cwd(), config.paths.src, config.paths.framework.base)
    let command = ''

    if (fs.existsSync(frameworkPath)) {
      command = [
        'git add -A',
        'git diff-index --quiet --cached HEAD || git commit -m "' + config.plugin.name + ': Update framework to v' + config.plugin.frameworkVersion + '"'
      ].join(' && ')
    } else {
      command = [
        'git add -A',
        'git diff-index --quiet --cached HEAD || git commit -m "' + config.pluginname + ': Update readme.txt"'
      ]
    }

    exec(command, cb)
  })

  // stash uncommitted changes
  gulp.task('shell:git_stash', (cb) => {
    exec('git stash', cb)
  })

  // apply latest stash
  gulp.task('shell:git_stash_apply', (cb) => {
    exec('git stash apply', cb)
  })
}
