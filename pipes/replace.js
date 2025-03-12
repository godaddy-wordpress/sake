import lazypipe from 'lazypipe';
import replace from 'gulp-replace';
import sake from '../lib/sake.js'

/**
 * Replaces the minimum PHP version
 */
export const replaceMinimumPhpVersion = lazypipe()
  .pipe(replace, /MINIMUM_PHP_VERSION = .*\n/, `MINIMUM_PHP_VERSION = '${sake.options.minimum_php_version}';\n`)

/**
 * Replaces the minimum WP version
 */
export const replaceMinimumWpVersion = lazypipe()
  .pipe(replace, /('minimum_wp_version'[\s]*=>[\s]*)'([^']*)'/, (match, m) => `${m}'${sake.options.minimum_wp_version}'`)
  .pipe(replace, /Requires at least: .*/, () => `Requires at least: ${sake.options.minimum_wp_version}`)
  .pipe(replace, /MINIMUM_WP_VERSION = .*\n/, () => `MINIMUM_WP_VERSION = '${sake.options.minimum_wp_version}';\n`)

/**
 * Replaces the tested-up-to WP version
 */
export const replaceTestedUptoWpVersion = lazypipe()
  .pipe(replace, /Tested up to: .*/, () => `Tested up to: ${sake.options.tested_up_to_wp_version}`)

/**
 * Replaces the minimum WooCommerce version
 */
export const replaceMinimumWcVersion = lazypipe()
  .pipe(replace, /('minimum_wc_version'[\s]*=>[\s]*)'([^']*)'/, (match, m) => `${m}'${sake.options.minimum_wc_version}'`)
  .pipe(replace, /WC requires at least: .*/, () => `WC requires at least: ${sake.options.minimum_wc_version}`)
  .pipe(replace, /MINIMUM_WC_VERSION = .*\n/, () => `MINIMUM_WC_VERSION = '${sake.options.minimum_wc_version}';\n`)

/**
 * Replaces the tested-up-to WooCommerce version
 */
export const replaceTestedUpToWcVersion = lazypipe()
  .pipe(replace, /WC tested up to: .*/, () => `WC tested up to: ${sake.options.tested_up_to_wc_version}`)

/**
 * Replaces the framework version
 */
export const replaceFrameworkVersion = lazypipe()
  .pipe(replace, /SkyVerge\\WooCommerce\\PluginFramework\\v[0-9]+_[0-9]+_[0-9]+/g, (match) => 'SkyVerge\\WooCommerce\\PluginFramework\\v' + sake.options.framework_version.replace(/\./g, '_'))
  .pipe(replace, /SkyVerge\\\\WooCommerce\\\\PluginFramework\\\\v[0-9]+_[0-9]+_[0-9]+/g, (match) => 'SkyVerge\\\\WooCommerce\\\\PluginFramework\\\\v' + sake.options.framework_version.replace(/\./g, '_'))
  .pipe(replace, /SV_WC_Framework_Bootstrap::instance\(\)->register_plugin\( '([^']*)'/, () => `SV_WC_Framework_Bootstrap::instance()->register_plugin( '${sake.options.framework_version}'`)
  .pipe(replace, /FRAMEWORK_VERSION = .*\n/, () => `FRAMEWORK_VERSION = '${sake.options.framework_version}';\n`)

/**
 * Replaces the framework backwards compatible version
 */
export const replaceBackwardsCompatibleVersion = lazypipe()
  .pipe(replace, /('backwards_compatible'[\s]*=>[\s]*)'([^']*)'/, (match, m) => `${m}'${sake.options.backwards_compatible}'`)
