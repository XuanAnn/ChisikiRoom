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
    throw new Error(`${route}: ${response.status} ${await response.text()}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
async function account(password, name) {
  return api('/api/auth/register', null, {
    email: `ranking-${randomUUID()}@example.com`,
    password,
    displayName: name,
  });
}
async function launch(account, password) {
  const env = { ...process.env, CHISIKI_API_URL: base };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.CHISIKI_DEV;
  const flags = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'];
  const app = await _electron.launch({
    ...(process.env.VERIFY_EXECUTABLE
      ? { executablePath: process.env.VERIFY_EXECUTABLE, args: flags }
      : { args: [path.resolve(__dirname, '..'), ...flags] }),
    env,
  });
  const main = await app.firstWindow();
  await main.getByLabel('Email', { exact: true }).fill(account.user.email);
  await main.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await main.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(main.locator('.chat-workspace')).toBeVisible();
  return { app, main };
}
async function close(app) {
  await app
    .evaluate(({ BrowserWindow }) => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.destroy();
      }
    })
    .catch(() => {});
  await app.close().catch(() => {});
}
async function put(route, token, body) {
  const response = await fetch(base + route, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${route}: ${response.status} ${await response.text()}`);
  }
  return response.json();
}
test('chat actions sync quotes and tombstones; drafts and read state survive restart', async () => {
  const password = randomUUID();
  const owner = await account(password, 'Chat Owner');
  const guest = await account(password, 'Chat Guest');
  const room = await api('/api/chat-rooms', owner.token, {
    name: 'Chat nâng cao',
    privateRoom: false,
  });
  await api(`/api/chat-rooms/${room.id}/join`, guest.token, {});
  const sessions = [];
  try {
    const first = await launch(owner, password);
    sessions.push(first);
    const second = await launch(guest, password);
    sessions.push(second);
    const composer = first.main.getByRole('textbox', { name: `Nhắn tin trong # ${room.name}` });
    await composer.fill('Nội dung gốc để trả lời');
    await first.main.getByRole('button', { name: 'send', exact: true }).click();
    await expect(second.main.locator('.message p')).toHaveText('Nội dung gốc để trả lời');
    const original = (await api(`/api/chat-rooms/${room.id}/messages`, owner.token))[0];
    const own = first.main.locator(`[data-message-id="${original.id}"]`);
    await own.getByRole('button', { name: 'Thao tác tin nhắn', exact: true }).click();
    await first.main.getByRole('menuitem', { name: 'Ghim tin nhắn', exact: true }).click();
    await expect(second.main.getByRole('button', { name: /Tin ghim \(1\)/ })).toBeVisible();
    await second.main
      .locator(`[data-message-id="${original.id}"]`)
      .getByRole('button', { name: 'Trả lời tin nhắn', exact: true })
      .click();
    await second.main
      .getByRole('textbox', { name: `Nhắn tin trong # ${room.name}` })
      .fill('Tin trả lời');
    await second.main.getByRole('button', { name: 'send', exact: true }).click();
    await expect(first.main.locator('.message-quote span')).toHaveText('Nội dung gốc để trả lời');
    await own.getByRole('button', { name: 'Thao tác tin nhắn', exact: true }).click();
    await first.main.getByRole('menuitem', { name: 'Sửa tin nhắn', exact: true }).click();
    await first.main
      .getByRole('textbox', { name: 'Nội dung chỉnh sửa', exact: true })
      .fill('Nội dung đã sửa');
    await first.main.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await expect(second.main.locator('.message-quote span')).toHaveText('Nội dung đã sửa');
    await second.main.getByRole('button', { name: 'reload', exact: true }).click();
    await expect(second.main.locator('.message-quote span')).toHaveText('Nội dung đã sửa');
    await own.getByRole('button', { name: 'Thao tác tin nhắn', exact: true }).click();
    await first.main.getByRole('menuitem', { name: 'Xóa tin nhắn', exact: true }).click();
    await first.main.getByRole('button', { name: 'Xóa tin nhắn', exact: true }).click();
    await expect(second.main.locator('.message-quote span')).toHaveText('Tin nhắn đã xóa');
    await expect(second.main.getByRole('button', { name: /Tin ghim/ })).toHaveCount(0);
    const draftBox = second.main.getByRole('textbox', { name: `Nhắn tin trong # ${room.name}` });
    await draftBox.fill('Bản nháp còn sau khi mở lại');
    await expect
      .poll(
        async () =>
          (await api('/api/chat-rooms/state', guest.token)).find(
            (state) => state.roomId === room.id,
          )?.draft,
      )
      .toBe('Bản nháp còn sau khi mở lại');
    await close(second.app);
    sessions.pop();
    await composer.fill('Tin mới khi người nhận đóng ứng dụng');
    await first.main.getByRole('button', { name: 'send', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await api('/api/chat-rooms/state', guest.token)).find(
            (state) => state.roomId === room.id,
          )?.unreadCount,
      )
      .toBe(1);
    const restarted = await launch(guest, password);
    sessions.push(restarted);
    const restored = restarted.main.getByRole('textbox', { name: `Nhắn tin trong # ${room.name}` });
    await expect(restored).toHaveValue('Bản nháp còn sau khi mở lại');
    await expect
      .poll(
        async () =>
          (await api('/api/chat-rooms/state', guest.token)).find(
            (state) => state.roomId === room.id,
          )?.unreadCount,
      )
      .toBe(0);
    await restored.fill('Bản nháp làm mốc');
    await expect
      .poll(
        async () =>
          (await api('/api/chat-rooms/state', guest.token)).find(
            (state) => state.roomId === room.id,
          )?.draft,
      )
      .toBe('Bản nháp làm mốc');
    const state = (await api('/api/chat-rooms/state', guest.token)).find(
      (item) => item.roomId === room.id,
    );
    await put(`/api/chat-rooms/${room.id}/state/draft`, guest.token, {
      content: 'Bản trên máy khác',
      version: state.draftVersion,
    });
    await restored.fill('Nội dung cục bộ cần giữ');
    await expect(
      restarted.main.getByText('Bản nháp đã thay đổi trên máy khác', { exact: true }),
    ).toBeVisible();
    await expect(restored).toHaveValue('Nội dung cục bộ cần giữ');
    await restarted.main.getByRole('button', { name: 'Giữ bản này', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await api('/api/chat-rooms/state', guest.token)).find((item) => item.roomId === room.id)
            ?.draft,
      )
      .toBe('Nội dung cục bộ cần giữ');
    await restarted.main.screenshot({
      path: path.resolve(__dirname, '../../.runtime/chat-advanced-preview.png'),
    });
  } finally {
    for (const session of sessions) {
      await close(session.app);
    }
  }
});
