const log = require('fancy-log')
const fs = require('fs')
const path = require('path')
const shell = require('shelljs')

module.exports = (gulp, plugins, sake) => {
  gulp.task('bundle', gulp.parallel('bundle:scripts'))

  gulp.task('bundle:scripts', () => {
    const scripts = sake?.config?.bundle?.scripts;

    // bail if no scripts to bundle
    if (! scripts || !Array.isArray(scripts) || scripts.length === 0) {
      log.info('No script dependencies to bundle.')
      return;
    }

    log.info('Bundling script dependencies.')

    // if there are scripts to bundle, make sure the dependencies are installed, or bail on error
    try {
      shell.exec('npm install', { stdio: 'inherit' });
    } catch (error) {
      sake.throwError('Error during npm install:' + error.message ?? 'unknown error.')
    }

    // loop through each script and copy it over the designated destination folder in the local plugin file path
    scripts.forEach((script) => {
      const { package: packageName, file, destination } = script

      // fetch the package name from node_modules
      const packagePath = path.join('node_modules', packageName)

      // check if the package exists
      if (!fs.existsSync(packagePath)) {
        sake.throwError(`Package '${packageName}' not found in node_modules.`)
      }

      // copy the specified file to the destination path
      const destinationFolder = path.join(destination);
      const sourceFilePath = path.join(packagePath, file)
      const destinationFilePath = path.join(destination, file)

      try {
        // create folder if it does not exist
        if (!fs.existsSync(destinationFolder)) {
          fs.mkdirSync(destinationFolder, { recursive: true })
          log.info(`Created destination folder for '${file}: '${destinationFolder}'.`)
        }

        // copy into destination folder
        fs.copyFileSync(sourceFilePath, destinationFilePath);
        log.info(`Bundled '${file}' from '${packageName}' to '${destination}'.`)
      } catch (error) {
        sake.throwError(`Error copying '${file}' from '${sourceFilePath}' to '${destinationFilePath}': ` + error.message ?? 'unknown error.')
      }
    })
  })
}
