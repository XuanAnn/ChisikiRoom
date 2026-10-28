const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: '../.runtime/web-playwright',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    channel: 'chrome',
    headless: true,
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5174',
    env: { BACKEND_URL: 'http://127.0.0.1:18190' },
    reuseExistingServer: false,
  },
});
