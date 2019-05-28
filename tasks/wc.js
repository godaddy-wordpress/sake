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

    let url = getApiURL('queue-item')

    if (sake.options.debug) {
      log.info('GET: ', url)
    }

    axios.get(url, apiOptions)
      .then(res => {
        if (sake.options.debug) {
          log.info('Response:')
          console.debug(res.data)
        }

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

        log.info('Plugin can be deployed')

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

    let url = getApiURL('init')

    if (sake.options.debug) {
      log.info('POST: ', url)
    }

    axios.post(url, null, apiOptions)
      .then(res => {
        if (sake.options.debug) {
          log.info('Response:')
          console.debug(res.data)
        }

        if (res.data.code) {
          throw `Unexpected response code from WC API (${res.data.code})`
        }

        if (!res.data.upload_url) {
          throw `WC API did not return a upload URL`
        }

        sake.options.wc_upload_url = res.data.upload_url

        log.info('Received upload URL (%s)', res.data.upload_url)

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

    let url = sake.options.wc_upload_url

    if (sake.options.debug) {
      log.info('POST: ', url)
      log.info('Using ZIP file: %s as %s', zipPath, `${sake.config.plugin.id}.zip`)
    }

    // Using request module here because it looks like axios does not really support
    // uploads in node, yet: https://github.com/axios/axios/issues/2
    require('request').post({
      url: url,
      formData: {
        file: {
          value: fs.createReadStream(zipPath),
          options: {
            filename: `${sake.config.plugin.id}.zip`,
            contentType: 'application/zip'
          }
        }
      },
      json: true
    }, (err, res, body) => {

      if (err) {
        throw `Unexpected error when uploading (${err})`
      }

      if (sake.options.debug) {
        log.info('Response:')
        console.debug(body)
      }

      if (body.code) {
        throw `Unexpected response code from WC API (${body.code})`
      }

      if (!body.queue_item_id || !body.success) {
        throw `WC API did not return a queue item id or successful response (${body.message})`
      }

      sake.options.wc_upload_queue_item_id = body.queue_item_id

      log.info('Plugin successfully uploaded')

      done()
    })
  })

  // internal task that handles notifying Woo that the upload has finished
  gulp.task('wc:notify', (done) => {
    log.info('Notifying Woo that the plugin has been uploaded...')

    let url = getApiURL('queue-item')

    if (sake.options.debug) {
      log.info('PATCH: ', url)
    }

    axios.patch(url, {
      queue_item_id: sake.options.wc_upload_queue_item_id,
      queue_item_version: sake.getPluginVersion()
    }, apiOptions)
      .then(res => {
        if (sake.options.debug) {
          log.info('Response:')
          console.debug(res.data)
        }

        if (res.data.code) {
          throw `Unexpected response code from WC API (${res.data.code})`
        }

        log.info('Woo has been notified!')

        done()
      })
      .catch(err => {
        sake.throwDeferredError(formatError(err))
      })
  })

  // the main task to deploy woocommerce.com plugins
  gulp.task('wc:deploy', gulp.series('wc:validate', 'wc:init', 'wc:upload', 'wc:notify'))
}
