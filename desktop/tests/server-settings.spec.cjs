const { test, expect, _electron } = require('@playwright/test');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');

test('checking a server preserves the saved address and reports health failures', async () => {
  let healthy = true;
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: healthy ? 'UP' : 'DOWN' }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const serverUrl = `http://127.0.0.1:${server.address().port}`;
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'chisiki-server-check-'));
  const env = { ...process.env, CHISIKI_API_URL: 'http://localhost:18081' };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.CHISIKI_DEV;
  let application;

  try {
    application = await _electron.launch({
      args: [path.resolve(__dirname, '..'), `--user-data-dir=${userData}`],
      env,
    });
    const page = await application.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: /Máy chủ$/ }).click();
    await page.getByLabel('Địa chỉ máy chủ').fill(serverUrl);
    await page.getByRole('button', { name: 'Kiểm tra kết nối', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Backend đang hoạt động');
    const saved = await page.evaluate(() => window.chisiki.serverSettings());
    expect(saved.data).toBe('http://localhost:18081');

    healthy = false;
    await page.getByRole('button', { name: 'Kiểm tra kết nối', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('chưa sẵn sàng');
    await page.getByRole('button', { name: 'Máy chủ Internet', exact: true }).click();
    await expect(page.getByLabel('Địa chỉ máy chủ')).toHaveValue('https://api.nguyenxuanan.id.vn');
    await expect(page.getByRole('alert')).toHaveCount(0);
  } finally {
    if (application) {
      await application.close();
    }
    await new Promise((resolve) => server.close(resolve));
    // The temporary profile is isolated from the user's actual Electron profile.
  }
});
