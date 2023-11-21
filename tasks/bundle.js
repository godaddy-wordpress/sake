const log = require('fancy-log')
const fs = require('fs')
const path = require('path')
const shell = require('shelljs')

module.exports = (gulp, plugins, sake) => {

  gulp.task('bundle', (done) => {
    let tasks = ['bundle:scripts', 'bundle:styles']

    if (sake?.config?.bundle) {
      // if there are items to bundle, make sure the dependencies are installed, or bail on error
      log.info('Installing external dependencies...')
      try {
        shell.exec('npm install', { stdio: 'inherit' })
      } catch (error) {
        sake.throwError(`Error during npm install: ${error.message ?? 'unknown error.'}`)
        done(error)
      }
    }

    gulp.parallel(tasks)(done)
  })

  const processBundle = (bundleType, bundleArray, done) => {
    // bail if no items to bundle
    if (!bundleArray || !Array.isArray(bundleArray) || bundleArray.length === 0) {
      log.info(`No external ${bundleType} to bundle.`)
      done()
      return
    }

    log.info(`Bundling ${bundleType} dependencies.`)

    // loop through each item and copy it over the designated destination folder in the local plugin file path
    bundleArray.forEach((item) => {
      const { source: packageName, file, destination } = item

      // fetch the package name from node_modules
      const packagePath = path.join('node_modules', packageName)

      // check if the package exists
      if (!fs.existsSync(packagePath)) {
        sake.throwError(`Package '${packageName}' not found in node_modules.`)
        done(`Package '${packageName}' not found in node_modules.`)
        return
      }

      // copy the specified file to the destination path
      const destinationFolder = path.join(destination)
      const sourceFilePath = path.join(packagePath, file)
      const destinationFilePath = path.join(destination, file)

      try {
        // create folder if it does not exist
        if (!fs.existsSync(destinationFolder)) {
          fs.mkdirSync(destinationFolder, { recursive: true })
          log.info(`Created destination folder for '${file}: '${destinationFolder}'.`)
        }

        // copy into destination folder
        fs.copyFileSync(sourceFilePath, destinationFilePath)
        log.info(`Bundled '${file}' from '${packageName}' to '${destination}'.`)
      } catch (error) {
        sake.throwError(`Error copying '${file}' from '${sourceFilePath}' to '${destinationFilePath}': ${error.message ?? 'unknown error.'}`)
        done(error)
      }
    })

    done()
  }

  gulp.task('bundle:scripts', (done) => {
    const bundle = sake?.config?.bundle
    const scripts = bundle?.scripts
    processBundle('scripts', scripts, done)
  })

  gulp.task('bundle:styles', (done) => {
    const bundle = sake?.config?.bundle
    const styles = bundle?.styles
    processBundle('styles', styles, done)
  })
}
