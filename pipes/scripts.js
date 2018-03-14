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
    .pipe(plugins.eslint.format)
    .pipe(plugins.eslint.failAfterError) // fail task on errors

  pipes.minify = lazypipe()
      // 1. Because CoffeeScript 2 will compile to ES6, we need to use babel to transpile it to ES2015,
      // note that this will also enable us to use ES6 in our plain JS.
      // 2. We need to tell Babel to find the preset from this project, not from the current working directory,
      // see https://github.com/babel/babel-loader/issues/299#issuecomment-259713477.
      .pipe(plugins.babel, { presets: ['babel-preset-env'].map(require.resolve) })
      .pipe(plugins.if, config.minify, plugins.uglify)
      .pipe(plugins.rename, { suffix: '.min' })
      .pipe(plugins.sourcemaps.write, '.', { mapFile: (mapFilePath) => mapFilePath.replace('.js.map', '.map') }) // source map files are named *.map instead of *.js.map

  return { scripts: pipes }
}
