'use strict';

const {defineConfig} = require('@playwright/test');
const path = require('node:path');
const os = require('node:os');
const {existsSync} = require('node:fs');

const port = 3007;
const database = path.join(os.tmpdir(), `vi-nho-playwright-${process.pid}.sqlite`);
const windowsChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
  (process.platform === 'win32' && existsSync(windowsChrome) ? windowsChrome : undefined);

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'browser.spec.js',
  timeout: 30000,
  expect: {timeout: 7000},
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results/playwright',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    headless: true,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    channel: executablePath ? undefined : 'chrome',
    launchOptions: executablePath ? {executablePath} : {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off'
  },
  webServer: {
    command: 'node server.js',
    url: `http://127.0.0.1:${port}/health`,
    timeout: 30000,
    reuseExistingServer: false,
    env: {...process.env, PORT: String(port), VN_DB_PATH: database, NODE_ENV: 'test'}
  }
});
