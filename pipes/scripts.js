import lazypipe from 'lazypipe';
import babel from 'gulp-babel'
import gulpif from 'gulp-if'
import uglify from 'gulp-uglify'
import rename from 'gulp-rename'
import sourcemaps from 'gulp-sourcemaps'
import sake from '../lib/sake.js'
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

export function scriptPipes() {
  const pipes = {}

  // transpile, minify and write sourcemaps
  // 1. Because CoffeeScript 2 will compile to ES6, we need to use babel to transpile it to ES2015,
  // note that this will also enable us to use ES6 in our plain JS.
  // 2. When not using CoffeeScript, regular JavaScript files that may contain ES6 code will also be transpiled to ES2015 automatically.
  // 3. We need to tell Babel to find the preset from this project, not from the current working directory,
  // see https://github.com/babel/babel-loader/issues/299#issuecomment-259713477.
  pipes.compileJs = lazypipe()
    .pipe(babel, { presets: ['@babel/preset-env', '@babel/preset-react'].map(require.resolve) })
    .pipe(() => {
      // see https://github.com/OverZealous/lazypipe#using-with-more-complex-function-arguments-such-as-gulp-if
      return gulpif(sake.options.minify, uglify())
    })
    .pipe(rename, { suffix: '.min' })
    // ensure admin/ and frontend/ are removed from the source paths
    // see https://www.npmjs.com/package/gulp-sourcemaps#alter-sources-property-on-sourcemaps
    .pipe(sourcemaps.mapSources, (sourcePath) => '../' + sourcePath)
    .pipe(sourcemaps.write, '.', { includeContent: false })

  return pipes
}
