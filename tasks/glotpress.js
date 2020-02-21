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
}
