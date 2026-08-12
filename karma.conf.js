// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html
// Puppeteer 25 made executablePath() async, and this file is CommonJS so it
// cannot await at module scope. computeExecutablePath() is the synchronous
// equivalent and takes the same build id puppeteer itself resolves.
const { PUPPETEER_REVISIONS } = require('puppeteer')
const { computeExecutablePath } = require('@puppeteer/browsers')

process.env.CHROME_BIN = computeExecutablePath({
  browser: 'chrome',
  buildId: PUPPETEER_REVISIONS.chrome,
  cacheDir:
    process.env.PUPPETEER_CACHE_DIR ||
    require('path').join(require('os').homedir(), '.cache', 'puppeteer'),
})

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage-istanbul-reporter'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: {
      clearContext: false, // leave Jasmine Spec Runner output visible in browser
    },
    coverageIstanbulReporter: {
      dir: require('path').join(__dirname, './coverage/butler'),
      reports: ['html', 'lcovonly', 'text-summary'],
      fixWebpackSourcePaths: true,
    },
    reporters: ['progress', 'kjhtml'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['ChromeHeadlessCI'],
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox'],
      },
    },
    singleRun: false,
    restartOnFileChange: true,
  })
}
