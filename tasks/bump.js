module.exports = (gulp, plugins, sake) => {
  const pipes = require('../pipes/replace.js')(plugins, sake)

  // bumps the version in the main plugin file to match changelog.txt
  gulp.task('bump', () => {
    let pluginFiles = [`${sake.config.paths.src}/${sake.config.plugin.mainFile}`]

    // also include the main Plugin class file
    if (sake.config.framework === 'v5') {
      pluginFiles.push(`${sake.config.paths.src}/includes/Plugin.php`)
    }

    return gulp.src(pluginFiles, { base: '.', allowEmpty: true })
      .pipe(plugins.replace(/ \* Version: [0-9]*.[0-9]*.[0-9]*(-[a-z]+.[0-9]+)*\n/, () => ' * Version: ' + sake.getPluginVersion() + '\n'))
      .pipe(plugins.replace(/const VERSION = '[0-9]*.[0-9]*.[0-9]*(-[a-z]+.[0-9]+)*';/, () => "const VERSION = '" + sake.getPluginVersion() + "';"))
      .pipe(gulp.dest(sake.config.paths.src))
  })

  // bumps the minimum requirements for the plugin
  gulp.task('bump:minreqs', () => {
    // helper to determine if a number is an integer
    let isInt = (n) => {
      return n % 1 === 0
    }

    // semver-ify versions passed in as integers
    ['minimum_wp_version', 'tested_up_to_wp_version', 'minimum_wc_version', 'tested_up_to_wc_version', 'framework_version', 'backwards_compatible'].forEach((option) => {
      if (sake.options[option] && isInt(sake.options[option])) {
        sake.options[option] = parseFloat(sake.options[option]).toFixed(1)
      }
    })

    return gulp.src([`${sake.config.paths.src}/${sake.config.plugin.mainFile}`, `${sake.config.paths.src}/readme.txt`])
      // note the need to cast the version optiosn to boolean, as passing a string version,
      // such as '4.4.0' will not evaluate to true in gulp-if
      .pipe(plugins.if(Boolean(sake.options.minimum_php_version), pipes.minimum_php_version()))
      .pipe(plugins.if(Boolean(sake.options.minimum_wp_version), pipes.minimum_wp_version()))
      .pipe(plugins.if(Boolean(sake.options.tested_up_to_wp_version), pipes.tested_up_to_wp_version()))
      .pipe(plugins.if(Boolean(sake.options.minimum_wc_version), pipes.minimum_wc_version()))
      .pipe(plugins.if(Boolean(sake.options.tested_up_to_wc_version), pipes.tested_up_to_wc_version()))
      .pipe(plugins.if(Boolean(sake.options.framework_version), pipes.framework_version()))
      .pipe(plugins.if(Boolean(sake.options.backwards_compatible && sake.config.framework === 'v4'), pipes.backwards_compatible()))
      .pipe(gulp.dest(sake.config.paths.src))
  })

  // bumps the v5 framework version in plugin files
  gulp.task('bump:framework_version', () => {
    return gulp.src([`${sake.config.paths.src}/**/*.php`, `!${sake.config.paths.src}/${sake.config.paths.framework.base}`])
      .pipe(plugins.if(Boolean(sake.options.framework_version), pipes.framework_version()))
      .pipe(gulp.dest(sake.config.paths.src))
  })
}
