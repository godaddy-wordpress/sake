import lazypipe from 'lazypipe';

// these pipes are not meant to be reusable - rather, they existy so that the bump:minreqs task would
// be easier to maintain without wrapping each individual replacement in gulp-if
module.exports = (plugins, sake) => {
  const pipes = {}

  // replace minimum PHP version
  pipes.minimum_php_version = lazypipe()
    .pipe(plugins.replace, /MINIMUM_PHP_VERSION = .*\n/, `MINIMUM_PHP_VERSION = '${sake.options.minimum_php_version}';\n`)

  // replace minimum WP version
  pipes.minimum_wp_version = lazypipe()
    .pipe(plugins.replace, /('minimum_wp_version'[\s]*=>[\s]*)'([^']*)'/, (match, m) => `${m}'${sake.options.minimum_wp_version}'`)
    .pipe(plugins.replace, /Requires at least: .*/, () => `Requires at least: ${sake.options.minimum_wp_version}`)
    .pipe(plugins.replace, /MINIMUM_WP_VERSION = .*\n/, () => `MINIMUM_WP_VERSION = '${sake.options.minimum_wp_version}';\n`)

  // replace tested up to WP version
  pipes.tested_up_to_wp_version = lazypipe()
    .pipe(plugins.replace, /Tested up to: .*/, () => `Tested up to: ${sake.options.tested_up_to_wp_version}`)

  // replace minimum WC version
  pipes.minimum_wc_version = lazypipe()
    .pipe(plugins.replace, /('minimum_wc_version'[\s]*=>[\s]*)'([^']*)'/, (match, m) => `${m}'${sake.options.minimum_wc_version}'`)
    .pipe(plugins.replace, /WC requires at least: .*/, () => `WC requires at least: ${sake.options.minimum_wc_version}`)
    .pipe(plugins.replace, /MINIMUM_WC_VERSION = .*\n/, () => `MINIMUM_WC_VERSION = '${sake.options.minimum_wc_version}';\n`)

  // replace tested up to WC version
  pipes.tested_up_to_wc_version = lazypipe()
    .pipe(plugins.replace, /WC tested up to: .*/, () => `WC tested up to: ${sake.options.tested_up_to_wc_version}`)

  // replace FW version
  pipes.framework_version = lazypipe()
    .pipe(plugins.replace, /SkyVerge\\WooCommerce\\PluginFramework\\v[0-9]+_[0-9]+_[0-9]+/g, (match) => 'SkyVerge\\WooCommerce\\PluginFramework\\v' + sake.options.framework_version.replace(/\./g, '_'))
    .pipe(plugins.replace, /SkyVerge\\\\WooCommerce\\\\PluginFramework\\\\v[0-9]+_[0-9]+_[0-9]+/g, (match) => 'SkyVerge\\\\WooCommerce\\\\PluginFramework\\\\v' + sake.options.framework_version.replace(/\./g, '_'))

  // replace FW version v4 and v5
  pipes.framework_version = lazypipe()
    .pipe(plugins.replace, /SV_WC_Framework_Bootstrap::instance\(\)->register_plugin\( '([^']*)'/, () => `SV_WC_Framework_Bootstrap::instance()->register_plugin( '${sake.options.framework_version}'`)
    .pipe(plugins.replace, /FRAMEWORK_VERSION = .*\n/, () => `FRAMEWORK_VERSION = '${sake.options.framework_version}';\n`)

  // replace FW backwards compatibility
  pipes.backwards_compatible = lazypipe()
    .pipe(plugins.replace, /('backwards_compatible'[\s]*=>[\s]*)'([^']*)'/, (match, m) => `${m}'${sake.options.backwards_compatible}'`)

  return pipes
}
