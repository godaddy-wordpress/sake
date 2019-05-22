#!/usr/bin/env node
const { spawn } = require('child_process')
const path = require('path')

/**
 * `sake` is simply a nice wrapper around `gulp`, designed simplify using gulp
 * as our build/deploy tool. It passes the gulpfile from sake's directory instead
 * of the plugin repo and sets the correct current working directory. It works by
 * spawning a child node process, which runs gulp with our CLI args.
 *
 * Last, but not least - it also gives us a nice branded CLI command :)
 */

// Setup args to pass to node child process - note that we don not spawn gulp's bin directly
// but rather node, passing in gulp's executable as the first argument. This is to ensure it
// works on Windows as well - see https://stackoverflow.com/a/43420003
// The concat portion passes in any optional CLI args as well as the gulpfile from sake and
// current workind directory.
const args = [
  require('resolve-bin').sync('gulp')
].concat(process.argv.splice(2).concat([
  '--gulpfile', path.join(__dirname, '../gulpfile.js'),
  '--cwd', process.cwd()
]))

// fire up gulp
spawn('node', args, { cwd: process.cwd(), stdio: 'inherit' })
