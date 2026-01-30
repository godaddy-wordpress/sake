import log from 'fancy-log'
import fs from 'node:fs'
import path from 'node:path'
import shell from 'shelljs'
import sake from '../lib/sake.js'
import gulp from 'gulp'

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

const bundleScriptsTask = (done) => {
  const bundle = sake?.config?.bundle
  processBundle('scripts', bundle?.scripts, done)
}
bundleScriptsTask.displayName = 'bundle:scripts'

const bundleStylesTask = (done) => {
  const bundle = sake?.config?.bundle
  processBundle('styles', bundle?.styles, done)
}
bundleStylesTask.displayName = 'bundle:styles'

const bundleTask = (done) => {
  let tasks = [bundleScriptsTask, bundleStylesTask]

  if (sake?.config?.bundle) {
    // if there are items to bundle, make sure the dependencies are installed, or bail on error
    log.info('Installing external dependencies...')

    let npmInstall = shell.exec('npm install')

    if (npmInstall.code !== 0) {
      sake.throwError(`Error during npm install: ${npmInstall.stderr ?? 'unknown error.'}`)
      done(npmInstall.stderr)
    }
  }

  gulp.parallel(tasks)(done)
}
bundleTask.displayName = 'bundle'

export {
  bundleScriptsTask,
  bundleStylesTask,
  bundleTask
}
