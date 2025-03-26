import inquirer from 'inquirer'
import semver from 'semver'
import log from 'fancy-log'
import chalk from 'chalk'
import _ from 'lodash'
import sake from '../lib/sake.js'
import gulp from 'gulp'
import { wcDeployTask } from './wc.js'
import { isNonInteractive } from '../helpers/arguments.js'

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
  let value = 1

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

/**
 * Internal task for prompting the deploy action
 */
const promptDeployTask = (done) => {
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
        const valid = semver.valid(value) && true
        return valid || 'Must be a valid semver, such as 1.2.3-rc1. See ' + chalk.underline.blue('https://semver.org/') + ' for more details.'
      }
    }
  ]).then(function (answers) {
    sake.options = _.merge(sake.options, answers)
    done()
  })
}
promptDeployTask.displayName = 'prompt:deploy'

/**
 * Internal task for prompting whether to upload the plugin to WooCommerce
 */
const promptWcUploadTask = (done) => {
  const uploadSeries = gulp.series(wcDeployTask)
  if (isNonInteractive()) {
    return uploadSeries(done)
  }

  inquirer.prompt([{
    type: 'confirm',
    name: 'upload_to_wc',
    message: 'Upload plugin to WooCommerce.com?'
  }]).then((answers) => {
    if (answers.upload_to_wc) {
      uploadSeries(done)
    } else {
      log.error(chalk.red('Skipped uploading to WooCommerce.com'))
      done()
    }
  })
}
promptWcUploadTask.displayName = 'prompt:wc_upload'

/**
 * Internal task for prompting whether the release has been tested
 */
const promptTestedReleaseZipTask = (done) => {
  if (isNonInteractive()) {
    return done()
  }

  inquirer.prompt([{
    type: 'confirm',
    name: 'tested_release_zip',
    message: 'Has the generated zip file for this release been tested?'
  }]).then((answers) => {
    if (answers.tested_release_zip) {
      done()
    } else {
      sake.throwError('Run npx sake zip to generate a zip of this release and test it on a WordPress installation.')
    }
  })
}
promptTestedReleaseZipTask.displayName = 'prompt:tested_release_zip'

export {
  promptDeployTask,
  promptWcUploadTask,
  promptTestedReleaseZipTask
}
