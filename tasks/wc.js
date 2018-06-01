const { Chromeless } = require('chromeless')
const request = require('request')
const shell = require('shelljs')
const path = require('path')
const fs = require('fs')

module.exports = (gulp, plugins, sake) => {
  const cookiePath = path.join(sake.config.paths.tmp, '_wcupload_cookies')

  const loadCookies = () => {
    return require('fs').readdirSync(cookiePath).map((file) => JSON.parse(fs.readFileSync(path.join(cookiePath, file), 'utf8')))
  }

  const haveCookiesExpired = (cookies) => {
    return cookies.some((cookie) => !cookie.value || (cookie.expires * 1000 <= new Date().getTime()))
  }

  // the main task to deploy the plugin zip to WooCommerce.com
  gulp.task('wc:deploy', (done) => {
    let tasks = ['wc:upload']

    // load cookies
    let cookies = loadCookies()
    let loginNeeded = !cookies.length || haveCookiesExpired(cookies)

    // fetch login cookies if none exist or expired
    if (loginNeeded) {
      tasks.unshift('wc:login')
    }

    let version = sake.getPluginVersion()
    let zipPath = path.join(process.cwd(), sake.config.paths.build, `${sake.config.plugin.id}.${version}.zip`)

    // create zip if none exists
    if (!fs.existsSync(zipPath)) {
      tasks.unshift('zip')
    }

    return gulp.series(tasks)(done)
  })

  // internal task that handles the zip file upload
  gulp.task('wc:upload', (done) => {
    let cookies = loadCookies()
    let version = sake.getPluginVersion()
    let zipPath = path.join(process.cwd(), sake.config.paths.build, `${sake.config.plugin.id}.${version}.zip`)
    let uploadUrl = `https://woocommerce.com/wp-admin/edit.php?post_type=product&page=view-product&post=${sake.config.deploy.wooId}`

    let options = {
      formData: {
        version_number: version,
        file: {
          value: fs.createReadStream(zipPath),
          options: {
            filename: sake.config.plugin.id + '.zip',
            contentType: 'application/zip'
          }
        },
        header: {
          Cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
        }
      }
    }

    // TODO: test this task before merging with master

    console.log(uploadUrl)
    console.log(options)

    done()

    // request.post(uploadUrl, options, (err, res, body) => {
    //   console.log(err)
    //   console.log(res.statusCode)
    //   console.log(body)
    // })
  })

  // internal task to fetch the WooCommerce.com login cookies using Chrome
  gulp.task('wc:login', (done) => {
    async function login () {
      const chromeless = new Chromeless()
      const cookies = await chromeless
        .goto('https://woocommerce.com/my-account')
        .type(process.env.WC_USERNAME, 'input[name="usernameOrEmail"]')
        .click('button[type="submit"]')
        .wait(1000) // wait for the password input to become visible
        .type(process.env.WC_PASSWORD, 'input[name="password"]')
        .click('button[type="submit"]')
        .wait('a.vendor-dashboard-link')
        .cookies()

      // ensure that the tmp dir exists
      if (!fs.existsSync(cookiePath)) {
        shell.mkdir('-p', cookiePath)
      }

      cookies.filter((cookie) => {
        return cookie.name.match(/wordpress_logged_in_*/)
      }).forEach((cookie) => {
        fs.writeFileSync(path.join(cookiePath, cookie.name), JSON.stringify(cookie))
      })

      await chromeless.end()
    }

    login().then(done)
  })
}
