import path from 'node:path';
import del from 'del';
import sake from '../lib/sake.js'

/**
 * Clean dev directory from map files
 */
const cleanDevTask = (done) => {
  return del([
    `${sake.config.paths.src}/${sake.config.paths.assets}/**/*.map`
  ])
}
cleanDevTask.displayName = 'clean:dev'

/**
 * Clean composer packages
 */
const cleanComposerTask = (done) => {
  return del([
    `${sake.config.paths.vendor}`
  ])
}
cleanComposerTask.displayName = 'clean:composer'

/**
 * Clean/empty the build directory
 */
const cleanBuildTask = (done) => {
  return del([
    `${sake.config.paths.build}/${sake.config.plugin.id}`,
    `${sake.config.paths.build}/${sake.config.plugin.id}.*.zip`
  ])
}
cleanBuildTask.displayName = 'clean:build'

/**
 * Clean the WooCommerce repo directory
 * This will automatically exclude any dotfiles, such as the .git directory
 */
const cleanWcRepoTask = (done) => {
  return del([
    sake.getProductionRepoPath() + '**/*'
  ])
}
cleanWcRepoTask.displayName = 'clean:wc_repo'

/**
 * Delete prerelease
 */
const cleanPrereleaseTask = (done) => {
  return del([
    sake.getPrereleasesPath() + sake.config.plugin.id + '*.zip',
    sake.getPrereleasesPath() + sake.config.plugin.id + '*.txt'
  ])
}
cleanPrereleaseTask.displayName = 'clean:prerelease'

/**
 * Clear WP repo trunk
 */
const cleanWpTrunkTask = (done) => {
  return del([
    path.join(sake.getProductionRepoPath(), 'trunk')
  ])
}
cleanWpTrunkTask.displayName = 'clean:wp_trunk'

/**
 * Clear WP repo assets
 */
const cleanWpAssetsTask = (done) => {
  return del([
    path.join(sake.getProductionRepoPath(), 'assets')
  ])
}
cleanWpAssetsTask.displayName = 'clean:wp_assets'

export {
  cleanDevTask,
  cleanComposerTask,
  cleanBuildTask,
  cleanWcRepoTask,
  cleanPrereleaseTask,
  cleanWpTrunkTask,
  cleanWpAssetsTask
}
