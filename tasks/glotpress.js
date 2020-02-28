const puppeteer = require('puppeteer')
const log = require('fancy-log')
const path = require('path')
const potomo = require('gulp-po2mo')

module.exports = (gulp, plugins, sake) => {
  // to write into Glotpress we need an high-privilege user
  const username = process.env.GLOTPRESS_USER
  const password = process.env.GLOTPRESS_PASSWORD
  // plugin variables
  let pluginName = sake.getPluginName(false)
  let pluginVersion = sake.getPluginVersion()
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

  // pull translations from GlotPress' corresponding master project: downloads an updated .po file into /i18n/languages, then compiles it to matching .mo counterpart
  gulp.task('translations:pull', (done) => {
    async function getLanguages () {
      const browser = await puppeteer.launch({ headless: false, dumpio: true, ignoreHTTPSErrors: true })
      const page = await browser.newPage()

      log.info('Fetching ' + pluginName + ' translations from ' + projectURL)

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

  // push translation source to a corresponding GlotPress master project: uploads an updated .pot file for the matching project corresponding to the current plugin
  gulp.task('translations:push', (done) => {
    async function pushPot () {
      const browser = await puppeteer.launch({ headless: false, dumpio: true, ignoreHTTPSErrors: true, args: ['--disable-web-security'] })
      const page = await browser.newPage()

      log.info('Pushing ' + pluginName + ' translation sources to ' + projectURL)

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
      await Promise.all([page.click('#wp-submit'), page.waitForNavigation()])

      log.info('Logged in!')

      // GlotPress original uploads page
      await page.goto(projectURL + 'import-originals/')

      // get the ElementHandle of the selector above
      const fileUpload = await page.$('input[name=import-file]')
      const potFile = i18nPath + sake.config.translations.source

      log.info('Uploading translations source file from ' + potFile)

      // this may seem to take an array of strings, while in fact just as simple string to the file path is what we need
      await fileUpload.uploadFile(potFile)
      await page.click('#submit')
      await page.waitForNavigation()

      log.info('Done!')

      await browser.close()
    }

    exports.default = pushPot()

    done()
  })

  // create a new translation project for the current version of the plugin
  gulp.task('translations:version', (done) => {
    async function createNewGlotPressProject () {
      const browser = await puppeteer.launch({ headless: false, dumpio: true, ignoreHTTPSErrors: true, args: ['--disable-web-security'] })
      const page = await browser.newPage()

      log.info('Creating new translations project for ' + pluginName + ' ' + pluginVersion + ' at ' + projectURL)

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
      await Promise.all([page.click('#wp-submit'), page.waitForNavigation()])

      log.info('Logged in!')

      // GlotPress new project page page
      await page.goto(glotpress + 'projects/-new/')

      // creates a project named after the current x.y.z version
      await page.waitFor('input[name="project[name]"]')
      await page.evaluate((text) => { (document.getElementById('project[name]')).value = text }, pluginVersion)
      await page.waitFor('select[name="project[parent_project_id]"]')

      // extract the plugin project ID in GlotPress
      let parentProject = (await page.$x('//*[@id = "project[parent_project_id]"]/option[text() = "' + pluginName + '"]'))[0]
      let parentProjectID = await (await parentProject.getProperty('value')).jsonValue()

      // creates the project as a sub-project of the identified parent project
      await page.select('select[name="project[parent_project_id]"]', parentProjectID)
      await page.waitFor('input[name="project[active]"]')
      await page.click('input[name="project[active]"]')
      await page.waitFor('input[name=submit]')
      await page.waitFor(1000)
      // for some odd reason clicking directly on the input won't work, but passing the button as an element to click on, will
      let submit = 'input#submit'
      await page.evaluate((submit) => document.querySelector(submit).click(), submit)

      await page.waitForNavigation()

      // GlotPress originals upload page for a specific sub-project
      await page.goto(projectURL + pluginVersion + '/import-originals/')

      // get the ElementHandle of the selector above
      const fileUpload = await page.$('input[name=import-file]')
      const potFile = i18nPath + sake.config.translations.source

      log.info('Uploading translations source file for version ' + pluginVersion + ' from ' + potFile)

      // this may seem to take an array of strings, while in fact just as simple string to the file path is what we need
      await fileUpload.uploadFile(potFile)
      await Promise.all([page.click('#submit'), page.waitForNavigation()])

      log.info('Mass-creating translations from existing' + pluginName + ' project base for version ' + pluginVersion)

      // GlotPress page for mass-creating translations from the master project's existing base
      await page.goto(projectURL + pluginVersion + '/-mass-create-sets/')
      await page.waitFor('select[name=project_id]')
      await page.select('select#project_id', parentProjectID) // the same parent project ID as before
      await page.waitFor('input[name=submit]')
      // wait for AJAX
      await page.waitFor(2000)
      await Promise.all([page.click('#submit'), page.waitForNavigation()])

      log.info('Done!')

      await browser.close()
    }

    exports.default = createNewGlotPressProject()

    done()
  })
}
