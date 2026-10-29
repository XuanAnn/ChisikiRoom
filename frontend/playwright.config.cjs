const { defineConfig } = require('@playwright/test');
const port = Number(process.env.WEB_TEST_PORT || 5184);
const baseURL = `http://127.0.0.1:${port}`;

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: '../.runtime/web-playwright',
  use: {
    baseURL,
    channel: 'chrome',
    headless: true,
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    env: { BACKEND_URL: 'http://127.0.0.1:18190' },
    reuseExistingServer: false,
  },
});
