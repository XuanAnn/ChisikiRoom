const { test, expect, _electron } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs/promises');
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
    throw new Error(`${route}: ${response.status} ${await response.text()}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
async function launch() {
  const env = { ...process.env, CHISIKI_API_URL: base };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.CHISIKI_DEV;
  const flags = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'];
  return _electron.launch({
    ...(process.env.VERIFY_EXECUTABLE
      ? { executablePath: process.env.VERIFY_EXECUTABLE, args: flags }
      : { args: [path.resolve(__dirname, '..'), ...flags] }),
    env,
  });
}
async function login(page, email, password) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('button', { name: /Phòng trò chuyện$/ })).toBeVisible();
}
test('Electron chat, separate quiz editor and two-peer battle media', async () => {
  const password = randomUUID();
  const emailA = `ui-a-${randomUUID()}@example.com`;
  const emailB = `ui-b-${randomUUID()}@example.com`;
  const a = await api('/api/auth/register', null, {
    email: emailA,
    password,
    displayName: 'An UI',
  });
  const b = await api('/api/auth/register', null, {
    email: emailB,
    password,
    displayName: 'Bình UI',
  });
  const friend = await api('/api/auth/register', null, {
    email: `ui-c-${randomUUID()}@example.com`,
    password,
    displayName: 'Chi UI',
  });
  await api('/api/friend-requests', a.token, { userId: friend.user.id });
  await api('/api/friend-requests/respond', friend.token, { senderId: a.user.id, accept: true });
  const room = await api('/api/chat-rooms', a.token, { name: 'Phòng học UI', privateRoom: false });
  await api(`/api/chat-rooms/${room.id}/join`, b.token, {});
  const apps = [];
  try {
    const appA = await launch();
    apps.push(appA);
    const pageA = await appA.firstWindow();
    await login(pageA, emailA, password);
    await pageA
      .getByRole('textbox', { name: 'Nhắn tin trong # Phòng học UI' })
      .fill('Xin chào từ giao diện Electron 👋');
    await pageA.getByRole('button', { name: 'send', exact: true }).click();
    await expect(pageA.locator('.message p')).toHaveText('Xin chào từ giao diện Electron 👋');
    await pageA.getByRole('button', { name: 'Thêm reaction' }).click();
    await pageA.getByRole('button', { name: '👍', exact: true }).click();
    await expect(pageA.getByRole('button', { name: '👍 1', exact: true })).toBeVisible();
    await pageA.getByRole('button', { name: 'Tìm tin nhắn', exact: true }).click();
    await pageA.getByPlaceholder('Nhập nội dung cần tìm…').fill('giao diện');
    await pageA.getByPlaceholder('Nhập nội dung cần tìm…').press('Enter');
    await expect(pageA.locator('.search-result p')).toHaveText('Xin chào từ giao diện Electron 👋');
    await pageA.locator('.ant-drawer-close').click();
    await pageA.getByRole('button', { name: /Mời thành viên$/ }).click();
    await pageA.getByRole('combobox', { name: 'Chọn bạn bè để mời' }).click();
    await pageA.locator('.ant-select-dropdown').getByText('Chi UI', { exact: true }).click();
    await pageA.getByRole('button', { name: 'Mời', exact: true }).click();
    await expect(pageA.locator('.context-members .member')).toHaveCount(3);
    await pageA.locator('.workspace-heading').click();
    await pageA.screenshot({ path: path.resolve(__dirname, '../../.runtime/chat-preview.png') });
    await pageA.getByRole('button', { name: 'book Bộ câu hỏi', exact: true }).click();
    await pageA.getByPlaceholder('Tìm bộ câu hỏi…').fill('N5');
    await expect(pageA.locator('.quiz-card')).toHaveCount(5);
    const templatePromise = appA.waitForEvent('window');
    await pageA.locator('.quiz-card').filter({ hasText: 'Hiragana' }).click();
    const templateEditor = await templatePromise;
    await expect(
      templateEditor.getByRole('button', { name: /Lưu bản sao cá nhân$/ }),
    ).toBeVisible();
    await expect(templateEditor.locator('.question-tile')).toHaveCount(10);
    await templateEditor.getByPlaceholder('Ví dụ: Khám phá khoa học').fill('Bản sao tiếng Nhật UI');
    await templateEditor.getByRole('button', { name: /Lưu bản sao cá nhân$/ }).click();
    await expect(templateEditor.getByText('Đã lưu', { exact: true })).toBeVisible();
    const templatesAfterCopy = (await api('/api/question-sets', a.token)).filter(
      (quiz) => quiz.ownerId === null,
    );
    expect(templatesAfterCopy).toHaveLength(10);
    const personalCopy = (await api('/api/question-sets', a.token)).find(
      (quiz) => quiz.title === 'Bản sao tiếng Nhật UI',
    );
    expect(personalCopy.ownerId).toBe(a.user.id);
    await templateEditor.close();
    await pageA.getByPlaceholder('Tìm bộ câu hỏi…').fill('');
    const editorPromise = appA.waitForEvent('window');
    await pageA.getByRole('button', { name: /Tạo bộ câu hỏi$/ }).click();
    const editor = await editorPromise;
    await editor.waitForLoadState('domcontentloaded');
    await editor.getByPlaceholder('Ví dụ: Khám phá khoa học').fill('Khoa học UI');
    await editor.getByPlaceholder('Nhập nội dung câu hỏi…').fill('1 + 1 bằng mấy?');
    for (const [i, value] of ['2', '3', '4', '5'].entries()) {
      await editor.getByPlaceholder(`Phương án ${String.fromCharCode(65 + i)}`).fill(value);
    }
    await editor.getByRole('button', { name: /Lưu bộ câu hỏi$/ }).click();
    await expect(editor.getByText('Đã lưu', { exact: true })).toBeVisible();
    await editor.screenshot({ path: path.resolve(__dirname, '../../.runtime/quiz-preview.png') });
    await pageA.getByRole('button', { name: 'reload', exact: true }).click();
    await expect(pageA.getByRole('button', { name: /Khoa học UI/ })).toBeVisible();
    await pageA.getByPlaceholder('Tìm bộ câu hỏi…').fill('khong co');
    await expect(pageA.locator('.quiz-card')).toHaveCount(0);
    await pageA.getByPlaceholder('Tìm bộ câu hỏi…').fill('khoa hoc');
    await expect(pageA.locator('.quiz-card')).toHaveCount(1);
    await pageA.getByRole('button', { name: /Tổng quan$/ }).click();
    await pageA.screenshot({
      path: path.resolve(__dirname, '../../.runtime/overview-real-preview.png'),
    });
    const quiz = (await api('/api/question-sets', a.token)).find((q) => q.title === 'Khoa học UI');
    const battle = await api('/api/battles', a.token, { roomId: room.id, questionSetId: quiz.id });
    await api(`/api/battles/${battle.id}/join`, b.token, {});
    await pageA.getByRole('button', { name: /Phòng trò chuyện$/ }).click();
    const battlePromiseA = appA.waitForEvent('window');
    await pageA.getByRole('button', { name: /Khoa học UI.*Tham gia/ }).click();
    const battleA = await battlePromiseA;
    battleA.on('console', (message) => {
      if (message.text().startsWith('media:')) {
        console.log('A', message.text());
      }
    });
    await battleA.waitForLoadState('domcontentloaded');
    const appB = await launch();
    apps.push(appB);
    const pageB = await appB.firstWindow();
    await login(pageB, emailB, password);
    const battlePromiseB = appB.waitForEvent('window');
    await pageB.getByRole('button', { name: /Khoa học UI.*Tham gia/ }).click();
    const battleB = await battlePromiseB;
    battleB.on('console', (message) => {
      if (message.text().startsWith('media:')) {
        console.log('B', message.text());
      }
    });
    await battleB.waitForLoadState('domcontentloaded');
    await battleA.getByRole('button', { name: /Bật camera$/ }).click();
    await battleB.getByRole('button', { name: /Bật camera$/ }).click();
    await expect(battleA.getByRole('button', { name: 'Đổi / mở lại camera' })).toBeVisible();
    await expect(battleB.getByRole('button', { name: 'Đổi / mở lại camera' })).toBeVisible();
    await expect
      .poll(() =>
        battleA
          .locator('video')
          .evaluateAll((videos) => videos.filter((video) => video.videoWidth > 0).length),
      )
      .toBe(2);
    await expect
      .poll(() =>
        battleB
          .locator('video')
          .evaluateAll((videos) => videos.filter((video) => video.videoWidth > 0).length),
      )
      .toBe(2);
    for (const page of [battleA, battleB]) {
      await page
        .locator('video')
        .evaluateAll((videos) => videos.forEach((video) => (video.volume = 0)));
    }
    await battleB.getByRole('button', { name: /Bật mic$/ }).click();
    await expect(battleB.getByRole('button', { name: /Tắt mic$/ })).toBeVisible();
    await expect
      .poll(() =>
        battleA
          .locator('video')
          .evaluateAll(
            (videos) =>
              videos.filter(
                (video) =>
                  !video.muted && video.srcObject?.getAudioTracks().some((track) => !track.muted),
              ).length,
          ),
      )
      .toBe(1);
    await battleB.getByRole('button', { name: /Tắt mic$/ }).click();
    await expect(battleB.getByRole('button', { name: /Bật mic$/ })).toBeVisible();
    await expect(battleA.locator('.battle-top-videos .video-tile')).toHaveCount(1);
    await expect(battleA.locator('.battle-side-videos .battle-self-preview')).toBeVisible();
    const topVideo = await battleA.locator('.battle-top-videos').boundingBox();
    const sideVideo = await battleA.locator('.battle-side-videos').boundingBox();
    expect(sideVideo.x).toBeGreaterThan(topVideo.x + topVideo.width);
    await battleA.getByRole('button', { name: 'Tôi đã sẵn sàng' }).click();
    await battleB.getByRole('button', { name: 'Tôi đã sẵn sàng' }).click();
    await expect(battleA.getByRole('button', { name: 'Bắt đầu trận' })).toBeEnabled();
    await battleA.getByRole('button', { name: 'Bắt đầu trận' }).click();
    await expect(battleB.getByRole('heading', { name: '1 + 1 bằng mấy?' })).toBeVisible();
    await battleB.getByRole('button', { name: 'A 2', exact: true }).click();
    await expect(battleA.getByText(/Bình UI trả lời đúng đầu tiên/)).toBeVisible();
    await battleA.screenshot({
      path: path.resolve(__dirname, '../../.runtime/battle-preview.png'),
    });
    await expect(battleB.getByText('KẾT QUẢ TRẬN ĐẤU')).toBeVisible();
  } catch (error) {
    let i = 0;
    for (const app of apps) {
      for (const page of app.windows()) {
        const text = await page
          .locator('body')
          .innerText()
          .catch(() => '');
        const media = await page
          .locator('video')
          .evaluateAll((videos) =>
            videos.map((v) => ({
              width: v.videoWidth,
              ready: v.readyState,
              paused: v.paused,
              muted: v.muted,
              active: v.srcObject?.active,
              tracks: v.srcObject?.getTracks().map((t) => ({
                kind: t.kind,
                muted: t.muted,
                enabled: t.enabled,
                state: t.readyState,
              })),
            })),
          )
          .catch(() => []);
        await fs.writeFile(
          path.resolve(__dirname, `../../.runtime/ui-failure-${i}.txt`),
          text + '\n' + JSON.stringify(media, null, 2),
        );
        await page
          .screenshot({ path: path.resolve(__dirname, `../../.runtime/ui-failure-${i++}.png`) })
          .catch(() => {});
      }
    }
    throw error;
  } finally {
    for (const app of apps) {
      await app
        .evaluate(({ BrowserWindow }) => {
          for (const win of BrowserWindow.getAllWindows()) {
            win.destroy();
          }
        })
        .catch(() => {});
      await app.close().catch(() => {});
    }
  }
});
