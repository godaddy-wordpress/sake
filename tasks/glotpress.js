const puppeteer = require('puppeteer')
const log = require('fancy-log')

module.exports = (gulp, plugins, sake) => {
  let glotpress = (sake.config.translations.glotpress).replace(/\/?$/, '/')
  let projectURL = (glotpress + 'projects/' + sake.config.translations.project).replace(/\/?$/, '/')
  let langPath = ('/projects/wp/skyverge/woocommerce-memberships' + sake.config.tasks.makepot.domainPath).replace(/\/?$/, '/')

  gulp.task('getpomo', (done) => {
    async function getLanguages () {
      const browser = await puppeteer.launch({ headless: false, dumpio: true })
      const page = await browser.newPage()
      log.info('Fetching translations from ' + projectURL)
      await page.goto(projectURL)
      const title = await page.title()
      log.info('Project page: ' + title)
      const languages = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('table tr td strong a'))
        return links.map(a => a.href)
      })
      log.info('Found ' + languages.length + ' languages')
      for (let language of languages) {
        log.info('Downloading ' + language + ' to ' + langPath)
        await page.goto(language)
        await page._client.send('Page.setDownloadBehavior', {behavior: 'allow', downloadPath: langPath})
        await page.click('#export')
        await page.waitFor(2000)
      }
      await browser.close()
    }
    exports.default = getLanguages()
    done()
  })
}
