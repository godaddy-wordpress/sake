#!/usr/bin/env node
const { spawn } = require('child_process')
const path = require('path')

// use our shared gulpfile
const gulpfile = path.join(__dirname, '../gulpfile.js')
// pass args through to gulp
const args = process.argv.splice(2).concat(['--gulpfile', gulpfile, '--cwd', process.cwd()])
// use local copy of gulp
const gulpPath = path.join(__dirname, '../node_modules/.bin/gulp')
// fire up gulp
spawn(gulpPath, args, { cwd: process.cwd(), stdio: 'inherit' })
