module.exports = (gulp, config, plugins, options, pipes) => {
  // bumps the version in the main plugin file to match changelog.txt
  gulp.task('bump', () => {
    return gulp.src(`${config.paths.src}/${config.plugin.mainFile}`)
      .pipe(plugins.replace(/ \* Version: [0-9]*.[0-9]*.[0-9]*(-[a-z]+.[0-9]+)*\n/, ' * Version: ' + config.plugin.version.current + '\n'))
      .pipe(plugins.replace(/const VERSION = '[0-9]*.[0-9]*.[0-9]*(-[a-z]+.[0-9]+)*';/, "const VERSION = '" + config.plugin.version.current + "';"))
      .pipe(gulp.dest(config.paths.src))
  })

  // bumps the minimum requirements for the plugin
  gulp.task('bump:minreqs', () => {
    // helper to determine if a number is an integer
    let isInt = (n) => {
      return n % 1 === 0
    }

    // semver-ify versions passed in as integers
    ['minimum_wp_version', 'tested_up_to_wp_version', 'minimum_wc_version', 'tested_up_to_wc_version', 'framework_version', 'backwards_compatible'].forEach((option) => {
      if (options[option] && isInt(options[option])) {
        options[option] = parseFloat(options[option]).toFixed(1)
      }
    })

    return gulp.src([`${config.paths.src}/${config.plugin.mainFile}`, `${config.paths.src}/readme.txt`])
      // note the need to cast the version optiosn to boolean, as passing a string version,
      // such as '4.4.0' will not evaluate to true in gulp-if
      .pipe(plugins.if(Boolean(options.minimum_php_version), pipes.replace.minimum_php_version()))
      .pipe(plugins.if(Boolean(options.minimum_wp_version), pipes.replace.minimum_wp_version()))
      .pipe(plugins.if(Boolean(options.tested_up_to_wp_version), pipes.replace.tested_up_to_wp_version()))
      .pipe(plugins.if(Boolean(options.minimum_wc_version), pipes.replace.minimum_wc_version()))
      .pipe(plugins.if(Boolean(options.tested_up_to_wc_version), pipes.replace.tested_up_to_wc_version()))
      .pipe(plugins.if(Boolean(options.framework_version && config.framework_version === 'v4'), pipes.replace.framework_version_v4()))
      .pipe(plugins.if(Boolean(options.backwards_compatible && config.framework_version === 'v4'), pipes.replace.backwards_compatible()))
      .pipe(gulp.dest(config.paths.src))
  })

  // bumps the v5 framework version in plugin files
  gulp.task('bump:framework_version', () => {
    return gulp.src([`${config.paths.src}/**/*.php`, `!${config.paths.src}/${config.paths.framework.base}`])
      .pipe(plugins.if(Boolean(options.framework_version), pipes.replace.framework_version()))
      .pipe(gulp.dest(config.paths.src))
  })
}
