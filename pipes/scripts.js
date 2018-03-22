const lazypipe = require('lazypipe')

module.exports = (plugins, sake) => {
  const pipes = {}

  // transpile, minify and write sourcemaps
  // 1. Because CoffeeScript 2 will compile to ES6, we need to use babel to transpile it to ES2015,
  // note that this will also enable us to use ES6 in our plain JS.
  // 2. We need to tell Babel to find the preset from this project, not from the current working directory,
  // see https://github.com/babel/babel-loader/issues/299#issuecomment-259713477.
  pipes.compileJs = lazypipe()
    .pipe(plugins.babel, { presets: ['babel-preset-env'].map(require.resolve) })
    .pipe(() => {
      // see https://github.com/OverZealous/lazypipe#using-with-more-complex-function-arguments-such-as-gulp-if
      return plugins.if(sake.options.minify, plugins.uglify())
    })
    .pipe(plugins.rename, { suffix: '.min' })
    // ensure admin/ and frontend/ are removed from the source paths
    // see https://www.npmjs.com/package/gulp-sourcemaps#alter-sources-property-on-sourcemaps
    .pipe(plugins.sourcemaps.mapSources, (sourcePath, file) => '../' + sourcePath)
    .pipe(plugins.sourcemaps.write, '.', { includeContent: false, mapFile: (mapFilePath) => mapFilePath.replace('.js.map', '.map') }) // source map files are named *.map instead of *.js.map

  return pipes
}
