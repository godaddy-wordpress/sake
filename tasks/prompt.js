const inquirer = require('inquirer')
const semver = require('semver')
const _ = require('lodash')
require('colors')

module.exports = (gulp, config, plugins, options) => {
  const util = require('../lib/utilities')(config, options)

  // internal task for prompting the deploy version
  gulp.task('prompt:deploy', (done) => {
    let currentVersion = util.getPluginVersion()

    inquirer.prompt([
      {
        name: 'version',
        type: 'list',
        message: 'Plugin Changelog: \n' + util.readChangelog() + '\n\nBump version from ' + currentVersion.cyan + ' to:',
        'default': getDefault(),
        choices: [
          {
            value: [ currentVersion, 'prerelease' ],
            name: 'Build:  '.yellow + util.getPluginVersion('prerelease').yellow +
            ' Unstable, betas, and release candidates.'
          },
          {
            value: [ currentVersion, 'patch' ],
            name: 'Patch:  '.yellow + util.getPluginVersion('patch').yellow +
            '   Backwards-compatible bug fixes.'
          },
          {
            value: [ currentVersion, 'minor' ],
            name: 'Minor:  '.yellow + util.getPluginVersion('minor').yellow +
            '   Add functionality in a backwards-compatible manner.'
          },
          {
            value: [ currentVersion, 'major' ],
            name: 'Major:  '.yellow + util.getPluginVersion('major').yellow +
            '   Incompatible API changes.'
          },
          {
            value: [ currentVersion, 'custom' ],
            name: 'Custom: ?.?.?'.yellow + '   Specify version...'
          },
          {
            value: [ currentVersion, 'skip' ],
            name: 'Skip this plugin'.red + '   This plugin will not be deployed'
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
        }, // jshint ignore:line
        validate: function (value) {
          var valid = semver.valid(value) && true
          return valid || 'Must be a valid semver, such as 1.2.3-rc1. See ' +
            'http://semver.org/'.blue.underline + ' for more details.'
        }
      } // jshint ignore:line
    ]).then(function (answers) {
      config.deploys = _.merge(config.deploys, answers)
      done()
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

    switch (util.getDefaultIncrement()) {
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
