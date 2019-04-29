const axios = require('axios')
const log = require('fancy-log')
const path = require('path')
const fs = require('fs')
const semver = require('semver')

module.exports = (gulp, plugins, sake) => {
  const wcRoot = 'https://woocommerce.com/wp-json/wccom/product-deploy/v1.0'

  let apiOptions = {
    auth: {
      username: process.env.WC_CONSUMER_KEY,
      password: process.env.WC_CONSUMER_SECRET
    },
    json: true
  }

  let getApiURL = (endpoint) => {
    return `${wcRoot}/products/${sake.config.deploy.wooId}/${endpoint}`
  }

  let formatError = (err) => {
    return err.response ? `WC API: ${err.response.data.message} (${err.response.data.code})` : err
  }

  // internal task to validate whether the plugin can be deployed to woocommerce.com
  gulp.task('wc:validate', done => {
    log.info('Making sure plugin is deployable...')

    axios.get(getApiURL('queue-item'), apiOptions)
      .then(res => {
        if (res.data.code && res.data.code === 'wccom_rest_no_queue_item') {
          log.info('No previous upload in queue')
          return done()
        }

        if (res.data.code) {
          throw `Unexpected response code from WC API (${res.data.code})`
        }

        if (res.data.queue_item_version && semver.gte(res.data.queue_item_version, sake.getPluginVersion())) {
          throw `Queued version for plugin is already higher than or equal to ${sake.getPluginVersion()}`
        }

        done()
      })
      .catch(err => {
        sake.throwDeferredError(formatError(err))
      })
  })

  // get the upload url for the plugin
  gulp.task('wc:init', done => {
    sake.options.wc_upload_url = null

    log.info('Getting plugin upload URL...')

    axios.post(getApiURL('init'), null, apiOptions)
      .then(res => {
        if (res.data.code) {
          throw `Unexpected response code from WC API (${res.data.code})`
        }

        if (res.data.upload_url) {
          throw `WC API did not return a upload URL`
        }

        sake.options.wc_upload_url = res.data.upload_url

        done()
      })
      .catch(err => {
        sake.throwDeferredError(formatError(err))
      })
  })

  // internal task that handles the zip file upload
  gulp.task('wc:upload', (done) => {
    let version = sake.getPluginVersion()
    let zipPath = path.join(process.cwd(), sake.config.paths.build, `${sake.config.plugin.id}.${version}.zip`)

    log.info('Uploading plugin to woocommerce.com...')

    axios.post(sake.options.wc_upload_url, {file: fs.createReadStream(zipPath)}, apiOptions)
      .then(res => {
        if (res.data.code) {
          throw `Unexpected response code from WC API (${res.data.code})`
        }

        if (!res.data.queue_item_id) {
          throw `WC API did not return a queue item id (${res.data.message})`
        }

        sake.options.wc_upload_queue_item_id = res.data.queue_item_id

        done()
      })
      .catch(err => {
        sake.throwDeferredError(formatError(err))
      })
  })

  // internal task that handles notifying Woo that the upload has finished
  gulp.task('wc:notify', (done) => {
    log.info('Notifying Woo that the plugin has been uploaded...')

    axios.patch(getApiURL('queue-item'), {
      queue_item_id: sake.options.wc_upload_queue_item_id,
      queue_item_version: sake.getPluginVersion()
    }, apiOptions)
      .then(res => {
        if (res.data.code) {
          throw `Unexpected response code from WC API (${res.data.code})`
        }
        done()
      })
      .catch(err => {
        sake.throwDeferredError(formatError(err))
      })
  })

  // the main task to deploy woocommerce.com plugins
  gulp.task('wc:deploy', gulp.series('wc:validate', 'wc:init', 'wc:upload', 'wc:notify'))
}
