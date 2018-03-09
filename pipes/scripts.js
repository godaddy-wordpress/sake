const lazypipe = require('lazypipe')
const path = require('path')

module.exports = (config, plugins, options) => {
  const pipes = {}

  let coffeeLintFile = options['coffeelint-file'] ? path.join(process.cwd(), options['coffeelint-file']) : null

  pipes.coffeelint = lazypipe()
    .pipe(plugins.coffeelint, coffeeLintFile)
    .pipe(plugins.coffeelint.reporter)
    .pipe(plugins.coffeelint.reporter, 'fail') // fail task when there are coffee errors

  pipes.eslint = lazypipe()
    .pipe(plugins.eslint, { configFile: options['eslint-configFile'] })
    .pipe(plugins.eslint.format) // simply output lint errors, do not fail on them

  return { scripts: pipes }
}
