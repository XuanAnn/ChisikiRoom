const { test, expect, _electron } = require('@playwright/test');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const base = process.env.VERIFY_API_URL || 'http://localhost:18080';
async function api(route, token, body) {
  const response = await fetch(base + route, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`${route}: ${response.status}`);
  }
  return response.json();
}
test('personal practice autosaves, resumes, grades and reviews mistakes', async () => {
  const password = randomUUID();
  const account = await api('/api/auth/register', null, {
    email: `practice-${randomUUID()}@example.com`,
    password,
    displayName: 'Practice UI',
  });
  const env = { ...process.env, CHISIKI_API_URL: base };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.CHISIKI_DEV;
  const app = await _electron.launch({ args: [path.resolve(__dirname, '..')], env });
  try {
    const main = await app.firstWindow();
    await main.getByLabel('Email', { exact: true }).fill(account.user.email);
    await main.getByLabel('Mật khẩu', { exact: true }).fill(password);
    await main.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await main.getByRole('button', { name: 'book Bộ câu hỏi', exact: true }).click();
    await main.getByPlaceholder('Tìm bộ câu hỏi…').fill('Hiragana');
    const promise = app.waitForEvent('window');
    await main.getByRole('button', { name: 'Luyện tập', exact: true }).click();
    const practice = await promise;
    await expect(practice.getByRole('heading', { name: /Hiragana/ })).toBeVisible();
    await practice.getByRole('radio', { name: 'A. ぬ', exact: true }).check();
    await expect(practice.getByText('1/10 câu đã chọn', { exact: true })).toBeVisible();
    await expect(practice.getByRole('radio', { name: 'A. ぬ', exact: true })).toBeEnabled();
    await practice.close();
    await main.getByRole('button', { name: 'Lịch sử luyện tập', exact: true }).click();
    const resumePromise = app.waitForEvent('window');
    await main.getByRole('button', { name: 'Làm tiếp', exact: true }).click();
    const resumed = await resumePromise;
    await expect(resumed.getByRole('radio', { name: 'A. ぬ', exact: true })).toBeChecked();
    await resumed.getByRole('button', { name: 'Nộp bài (1/10)', exact: true }).click();
    await expect(resumed.getByRole('heading', { name: 'Đúng 10%', exact: true })).toBeVisible();
    await expect(resumed.getByText(/ぬ được đọc là nu/)).toBeVisible();
    await resumed.screenshot({
      path: path.resolve(__dirname, '../../.runtime/practice-preview.png'),
    });
    const reviewPromise = app.waitForEvent('window');
    await resumed.getByRole('button', { name: 'Ôn câu sai / bỏ qua', exact: true }).click();
    const review = await reviewPromise;
    await expect(review.getByRole('heading', { name: /âm “ho”/ })).toBeVisible();
    await expect(review.locator('.practice-numbers button')).toHaveCount(9);
    const history = await api('/api/practice', account.token);
    expect(history).toHaveLength(2);
    expect(history.filter((item) => item.finishedAt)).toHaveLength(1);
  } finally {
    await app
      .evaluate(({ BrowserWindow }) => {
        for (const window of BrowserWindow.getAllWindows()) {
          window.destroy();
        }
      })
      .catch(() => {});
    await app.close();
  }
});
