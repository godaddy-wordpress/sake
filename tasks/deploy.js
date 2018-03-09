const fs = require('fs')

module.exports = (gulp, config, plugins, options, pipes) => {
  const util = require('../lib/utilities')(config, options)

  // deploy the plugin
  gulp.task('deploy', (done) => {
    // check for required environment vaiables and that WT_REPOS_PATH actually exists
    if (!(process.env.GITHUB_USERNAME && process.env.GITHUB_API_KEY && process.env.WT_REPOS_PATH && fs.existsSync(util.resolvePath(process.env.WT_REPOS_PATH)))) {
      throw new Error('Deploy failed :( Please check your environment vaiables')
    }

    if (!util.isDeployable()) {
      throw new Error('Deploy failed - plugin is not deployable: \n * ' + util.getChangelogErrors().join('\n * '))
    }

    // TODO: this task is a WIP
    gulp.series([
      'git:stash',
      'search:wt_update_key', // TODO: only for plugins that need to be deployed to WT repos
      'scripts:lint',
      'bump',
      'prompt:deploy'
    ])
  })

  // internal task for making sure the WT updater keys have been set
  gulp.task('search:wt_update_key', (done) => {
    fs.readFile(`${config.paths.src}/${config.plugin.mainFile}`, 'utf8', (err, data) => {
      if (err) {
        throw new Error(err)
      }

      let results = data.match(/woothemes_queue_update\s*\(\s*plugin_basename\s*\(\s*__FILE__\s*\)\s*,\s*'(.+)'\s*,\s*'(\d+)'\s*\);/ig)

      if (!results) {
        throw new Error('WooThemes updater keys for the plugin have not been properly set ;(')
      }

      done()
    })
  })
}
