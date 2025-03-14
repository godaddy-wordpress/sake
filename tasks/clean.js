import path from 'node:path';
import del from 'del';
import sake from '../lib/sake.js'

/**
 * Clean dev directory from map files
 */
const cleanDev = (done) => {
  return del([
    `${sake.config.paths.src}/${sake.config.paths.assets}/**/*.map`
  ])
}
cleanDev.displayName = 'clean:dev'

/**
 * Clean composer packages
 */
const cleanComposer = (done) => {
  return del([
    `${sake.config.paths.vendor}`
  ])
}
cleanComposer.displayName = 'clean:composer'

/**
 * Clean/empty the build directory
 */
const cleanBuild = (done) => {
  return del([
    `${sake.config.paths.build}/${sake.config.plugin.id}`,
    `${sake.config.paths.build}/${sake.config.plugin.id}.*.zip`
  ])
}
cleanBuild.displayName = 'clean:build'

/**
 * Clean the WooCommerce repo directory
 * This will automatically exclude any dotfiles, such as the .git directory
 */
const cleanWcRepo = (done) => {
  return del([
    sake.getProductionRepoPath() + '**/*'
  ])
}
cleanWcRepo.displayName = 'clean:wc_repo'

/**
 * Delete prerelease
 */
const cleanPrerelease = (done) => {
  return del([
    sake.getPrereleasesPath() + sake.config.plugin.id + '*.zip',
    sake.getPrereleasesPath() + sake.config.plugin.id + '*.txt'
  ])
}
cleanPrerelease.displayName = 'clean:prerelease'

/**
 * Clear WP repo trunk
 */
const cleanWpTrunk = (done) => {
  return del([
    path.join(sake.getProductionRepoPath(), 'trunk')
  ])
}
cleanWpTrunk.displayName = 'clean:wp_trunk'

/**
 * Clear WP repo assets
 */
const cleanWpAssets = (done) => {
  return del([
    path.join(sake.getProductionRepoPath(), 'assets')
  ])
}
cleanWpAssets.displayName = 'clean:wp_assets'

export {
  cleanDev,
  cleanComposer,
  cleanBuild,
  cleanWcRepo,
  cleanPrerelease,
  cleanWpTrunk,
  cleanWpAssets
}
