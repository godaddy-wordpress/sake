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
    return gulp.src([`${config.paths.src}/${config.plugin.mainFile}`, `${config.paths.src}/readme.txt`])
      .pipe(plugins.debug())
      // note the need to cast the version optiosn to boolean, as passing a string version,
      // such as '4.4.0' will not evaluate to true in gulp-if
      .pipe(plugins.if(Boolean(options.minimum_wp_version), pipes.replace.minimum_wp_version()))
      .pipe(plugins.if(Boolean(options.tested_up_to_wp_version), pipes.replace.tested_up_to_wp_version()))
      .pipe(plugins.if(Boolean(options.minimum_wc_version), pipes.replace.minimum_wc_version()))
      .pipe(plugins.if(Boolean(options.tested_up_to_wc_version), pipes.replace.tested_up_to_wc_version()))
      .pipe(plugins.if(Boolean(options.framework_version), pipes.replace.framework_version()))
      .pipe(plugins.if(Boolean(options.backwards_compatible), pipes.replace.backwards_compatible()))
      .pipe(gulp.dest(config.paths.src))
  })
}
