const inquirer = require('inquirer')
const semver = require('semver')
const log = require('fancy-log')
const chalk = require('chalk')
const _ = require('lodash')

module.exports = (gulp, plugins, sake) => {
  // internal task for prompting the deploy version
  gulp.task('prompt:deploy', (done) => {
    let currentVersion = sake.getPluginVersion()

    inquirer.prompt([
      {
        name: 'version',
        type: 'list',
        message: 'Plugin Changelog: \n' + sake.readChangelog() + '\n\nBump version from ' + chalk.cyan(currentVersion) + ' to:',
        'default': getDefault(),
        choices: [
          {
            value: [ currentVersion, 'prerelease' ],
            name: chalk.yellow('Build:  ' + sake.getPluginVersion('prerelease')) +
            ' Unstable, betas, and release candidates.'
          },
          {
            value: [ currentVersion, 'patch' ],
            name: chalk.yellow('Patch:  ' + sake.getPluginVersion('patch')) +
            '   Backwards-compatible bug fixes.'
          },
          {
            value: [ currentVersion, 'minor' ],
            name: chalk.yellow('Minor:  ' + sake.getPluginVersion('minor')) +
            '   Add functionality in a backwards-compatible manner.'
          },
          {
            value: [ currentVersion, 'major' ],
            name: chalk.yellow('Major:  ' + sake.getPluginVersion('major')) +
            '   Incompatible API changes.'
          },
          {
            value: [ currentVersion, 'custom' ],
            name: chalk.yellow('Custom: ?.?.?') + '   Specify version...'
          },
          {
            value: [ currentVersion, 'skip' ],
            name: chalk.red('Skip this plugin') + '   This plugin will not be deployed'
          }
        ],
        filter: filterIncrement
      },
      {
        name: 'version_custom',
        type: 'input',
        message: 'What specific version would you like',
        when: function (answers) {
          return _.values(answers).shift() === 'custom'
        },
        validate: function (value) {
          var valid = semver.valid(value) && true
          return valid || 'Must be a valid semver, such as 1.2.3-rc1. See ' + chalk.underline.blue('http://semver.org/') + ' for more details.'
        }
      }
    ]).then(function (answers) {
      sake.options = _.merge(sake.options, answers)
      done()
    })
  })

  // internal task for prompting whether to upload the plugin to woo
  gulp.task('prompt:wc_upload', (done) => {
    inquirer.prompt([{
      type: 'confirm',
      name: 'upload_to_wc',
      message: 'Upload plugin to WooCommerce.com?'
    }]).then((answers) => {
      if (answers.upload_to_wc) {
        gulp.series('wc:deploy')(done)
      } else {
        log.error(chalk.red('Skipped uploading to WooCommerce.com'))
        done()
      }
    })
  })

  function filterIncrement (value) {
    if (value[1] === 'custom') {
      return 'custom'
    }

    if (value[1] === 'skip') {
      return 'skip'
    }

    return semver.inc(value[0], value[1])
  }

  function getDefault () {
    var value = 1

    switch (sake.getDefaultIncrement()) {
      case 'minor':
        value = 2
        break

      case 'major':
        value = 3
        break
    }

    return value
  }
}
