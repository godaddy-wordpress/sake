#!/usr/bin/env node
const { spawn } = require('child_process')
const path = require('path')

// use our shared gulpfile
let gulpfile = path.join(__dirname, '../index.js')
// pass args through to gulp
let args = process.argv.splice(2).concat(['--gulpfile', gulpfile, '--cwd', process.cwd()])

// fire up gulp
spawn('gulp', args, { cwd: process.cwd(), stdio: 'inherit' })
