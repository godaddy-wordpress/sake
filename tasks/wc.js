const axios = require('axios')
const log = require('fancy-log')
const path = require('path')
const semver = require('semver')

module.exports = (gulp, plugins, sake) => {
  const wcRoot = 'https://woocommerce.com/wp-json/wc/submission/runner/v1'

  let apiOptions = {
    username: process.env.WC_USERNAME,
    password: process.env.WC_APPLICATION_PASSWORD,
    product_id: sake.config.deploy.wooId
  }

  let getApiURL = (endpoint) => {
    return `${wcRoot}/product/${endpoint}`
  }

  let formatError = (err) => {
    return err.response ? `WC API: ${err.response.data.message} (${err.response.data.code})` : err
  }

  // internal task to validate whether the plugin can be deployed to woocommerce.com
  gulp.task('wc:validate', done => {
    log.info('Making sure plugin is deployable...')

    let url = getApiURL('deploy/status')

    if (sake.options.debug) {
      log.info('GET: ', url)
    }

    // record whether we've logged the response, to avoid logging it in both the `then()` and `catch()` blocks
    let hasLoggedResponse = false;

    axios.post(url, apiOptions)
      .then(res => {
        if (sake.options.debug && ! hasLoggedResponse) {
          log.info('Response:')
          console.debug(res.data)
          hasLoggedResponse = true;
        }

        /*
         * Note: We'll only end up here if there was a previous deployment in progress. If there's no deployment at
         * all then we'll end up in the `catch()` block because Woo sends back a 400 status code for that, which is
         * actually an error state.
         */

        if (res.data.code) {
          throw `Unexpected response code from WC API (${res.data.code})`
        }

        if (res.data.version && semver.gte(res.data.version, sake.getPluginVersion())) {
          throw `Queued version for plugin is already higher than or equal to ${sake.getPluginVersion()}`
        }

        log.info('Plugin can be deployed')

        done()
      })
      .catch(err => {
        if (sake.options.debug && err.response && ! hasLoggedResponse) {
          log.info('Response:')
          console.debug(err.response.data)
          hasLoggedResponse = true;
        }

        // NOTE: if there's no deployment in progress then it's a 400 status code, which is why we end up in this catch block!
        if (err.response && err.response.data.code === 'submission_runner_no_deploy_in_progress') {
          log.info('No previous upload in queue')
          return done()
        }

        sake.throwDeferredError(formatError(err))
      })
  })

  // internal task that handles the zip file upload
  gulp.task('wc:upload', (done) => {
    let version = sake.getPluginVersion()
    let zipPath = path.join(process.cwd(), sake.config.paths.build, `${sake.config.plugin.id}.${version}.zip`)

    log.info('Uploading plugin to woocommerce.com...')

    let url = getApiURL('deploy')

    // record whether we've logged the response, to avoid logging it in both the `then()` and `catch()` blocks
    let hasLoggedResponse = false;

    if (sake.options.debug) {
      log.info('POST: ', url)
      log.info('Using ZIP file: %s as %s', zipPath, `${sake.config.plugin.id}.zip`)
    }

    let apiUploadOptions = apiOptions;
    apiUploadOptions.file = zipPath;
    apiUploadOptions.version = version;

    axios.post(url, apiUploadOptions)
      .then(res => {
        if (sake.options.debug && ! hasLoggedResponse) {
          log.info('Response:');
          console.debug(res.data);
          hasLoggedResponse = true;
        }

        if (! res.data.status) {
          throw `WC API did not return a deployment status`
        }

        if (res.data.status === 'failed') {
          throw `Deployment has failed`
        }

        log.info(`Plugin deployment created with status ${res.data.status}`)

        // @TODO if status is "pending-deploy" or "queued", do we want to poll it until successful? :thinking:

        done()
      })
      .catch(err => {
        if (sake.options.debug && err.response && ! hasLoggedResponse) {
          log.info('Response:')
          console.debug(err.response.data)
          hasLoggedResponse = true;
        }

        throw err;
      })
  })

  // the main task to deploy woocommerce.com plugins
  gulp.task('wc:deploy', gulp.series('wc:validate', 'wc:upload', 'wc:notify'))
}
