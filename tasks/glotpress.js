const puppeteer = require('puppeteer')
const log = require('fancy-log')
const path = require('path')
const potomo = require('gulp-po2mo')

module.exports = (gulp, plugins, sake) => {
  // full path to the GlotPress site where the current project is
  let glotpress = (sake.config.translations.glotpress).replace(/\/?$/, '/')
  let projectURL = (glotpress + 'projects/' + sake.config.translations.project).replace(/\/?$/, '/')
  // the absolute path where the translations should be downloaded or pushed from
  let i18nPath = process.cwd().replace(/\/$/, '') + sake.config.tasks.makepot.domainPath.replace(/\/?$/, '/')

  // compiles a .pot source file locally
  gulp.task('translations:source', (done) => {
    return gulp.series('makepot')(done)
  })

  // compiles .po files into .mo files locally
  gulp.task('translations:compile', (done) => {
    return gulp.src(`${i18nPath}**/*.po`)
      .pipe(potomo())
      .pipe(gulp.dest(i18nPath))
  })

  // pull translations from GlotPress: downloads an updated .po file into /i18n/languages, then compiles it to matching .mo counterpart
  gulp.task('translations:pull', (done) => {
    async function getLanguages () {
      const browser = await puppeteer.launch({ headless: false, dumpio: true, ignoreHTTPSErrors: true })
      const page = await browser.newPage()

      log.info('Fetching translations from ' + projectURL)

      await page.goto(projectURL)
      const title = await page.title()

      log.info('Project page: ' + title)

      // look for all languages listed in table and collect page URLs
      const languages = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('table tr td strong a'))
        return links.map(a => a.href)
      })

      log.info('Found ' + languages.length + ' languages')

      // loop found languages and download a translation file from each
      for (let language of languages) {
        log.info('Downloading translations from ' + language + ' to ' + i18nPath)

        await page.goto(language)
        await page._client.send('Page.setDownloadBehavior', {behavior: 'allow', downloadPath: path.resolve(i18nPath)})
        await page.click('#export')
        await page.waitFor(2000)
      }

      await browser.close()
    }

    exports.default = getLanguages()

    gulp.series('translations:compile')(done)
  })

  // push translation source to GlotPress: uploads an updated .pot file for the matching project corresponding to the current plugin
  gulp.task('translations:push', (done) => {
    async function pushPot () {
      const username = process.env.GLOTPRESS_USER
      const password = process.env.GLOTPRESS_PASSWORD
      const browser = await puppeteer.launch({ headless: false, dumpio: true, ignoreHTTPSErrors: true, args: ['--disable-web-security'] })
      const page = await browser.newPage()

      log.info('Pushing translations source to ' + projectURL)

      await page.goto(projectURL)

      const title = await page.title()

      log.info('Project page: ' + title)

      const logIn = await page.$x("//a[contains(text(), 'Log in')]")

      if (logIn.length > 0) {
        await logIn[0].click()
        await page.waitForNavigation()
      } else {
        throw new Error('Could not authenticate to GlotPress')
      }

      log.info('Logging in as admin...')

      // log in as admin
      await page.waitFor('input[name=log]')
      await page.evaluate((text) => { (document.getElementById('user_login')).value = text }, username)
      await page.waitFor('input[name=pwd]')
      await page.evaluate((text) => { (document.getElementById('user_pass')).value = text }, password)
      await page.waitFor('input[name=wp-submit]')
      await page.click('#wp-submit')

      log.info('Logged in!')

      await page.goto(projectURL + 'import-originals/')

      // get the ElementHandle of the selector above
      const fileUpload = await page.$('input[name=import-file]')
      const potFile = i18nPath + sake.config.translations.source

      log.info('Uploading translations source file from ' + potFile)

      await fileUpload.uploadFile(potFile)
      await page.click('#submit')
      await page.waitForNavigation()

      log.info('Done!')

      await browser.close()
    }

    exports.default = pushPot()

    done()
  })
}
