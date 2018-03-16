const lazypipe = require('lazypipe')

module.exports = (config, plugins, options) => {
  const pipes = {}

  // transpile, minify and write sourcemaps
  // 1. Because CoffeeScript 2 will compile to ES6, we need to use babel to transpile it to ES2015,
  // note that this will also enable us to use ES6 in our plain JS.
  // 2. We need to tell Babel to find the preset from this project, not from the current working directory,
  // see https://github.com/babel/babel-loader/issues/299#issuecomment-259713477.
  pipes.minify = lazypipe()
    .pipe(plugins.babel, { presets: ['babel-preset-env'].map(require.resolve) })
    .pipe(plugins.if, options.minify, plugins.uglify)
    .pipe(plugins.rename, { suffix: '.min' })
    .pipe(plugins.sourcemaps.write, '.', { mapFile: (mapFilePath) => mapFilePath.replace('.js.map', '.map') }) // source map files are named *.map instead of *.js.map

  return { scripts: pipes }
}
