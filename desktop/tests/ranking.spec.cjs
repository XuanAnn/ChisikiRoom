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
test('global ranking pairs two users, starts with camera consent and records forfeit', async () => {
  const password = randomUUID();
  const a = await account(password, 'Rank A');
  const b = await account(password, 'Rank B');
  const sessions = [];
  try {
    sessions.push(await launch(a, password));
    sessions.push(await launch(b, password));
    for (const session of sessions) {
      await session.main.getByRole('button', { name: 'trophy Xếp hạng', exact: true }).click();
    }
    await sessions[0].main.getByRole('button', { name: 'Tìm trận xếp hạng', exact: true }).click();
    await expect(sessions[0].main.getByText('Đang tìm đối thủ N5…', { exact: true })).toBeVisible();
    const windows = sessions.map((session) => session.app.waitForEvent('window'));
    await sessions[1].main.getByRole('button', { name: 'Tìm trận xếp hạng', exact: true }).click();
    const battles = await Promise.all(windows);
    for (const battle of battles) {
      await battle.getByRole('button', { name: /Bật camera$/ }).click();
      await expect(
        battle.getByRole('button', { name: 'Tôi đã sẵn sàng', exact: true }),
      ).toBeEnabled();
      await battle.getByRole('button', { name: 'Tôi đã sẵn sàng', exact: true }).click();
    }
    await expect(battles[0].locator('.round-panel')).toBeVisible();
    const queue = await api('/api/ranking/queue', b.token);
    await api(`/api/battles/${queue.battleId}/leave`, b.token, {});
    await expect(battles[0].getByText('KẾT QUẢ TRẬN ĐẤU', { exact: true })).toBeVisible();
    await expect(
      sessions[0].main.locator('.ranked-history').getByText('Thắng', { exact: true }),
    ).toBeVisible();
    const board = await api('/api/ranking?level=N5', a.token);
    expect(board.me.games).toBe(1);
    expect(board.me.rating).toBeGreaterThan(1500);
    expect(board.me.provisional).toBe(true);
    await sessions[0].main.screenshot({
      path: path.resolve(__dirname, '../../.runtime/ranking-preview.png'),
    });
  } finally {
    for (const session of sessions) {
      await close(session.app);
    }
  }
});
test('group invite remains pending until recipient accepts and supports decline', async () => {
  const password = randomUUID();
  const owner = await account(password, 'Group Owner');
  const guest = await account(password, 'Group Guest');
  const room = await api('/api/chat-rooms', owner.token, {
    name: 'Nhóm cần chấp nhận',
    privateRoom: true,
  });
  const sessions = [];
  try {
    sessions.push(await launch(owner, password));
    sessions.push(await launch(guest, password));
    await api(`/api/chat-rooms/${room.id}/invite`, owner.token, { userId: guest.user.id });
    await expect(sessions[0].main.locator('.context-members .member')).toHaveCount(1);
    await sessions[1].main.getByRole('button', { name: 'Lời mời nhóm', exact: true }).click();
    await expect(
      sessions[1].main.locator('.group-invitation').getByText(room.name, { exact: true }),
    ).toBeVisible();
    await sessions[1].main.getByRole('button', { name: 'Từ chối', exact: true }).click();
    await expect(
      sessions[1].main.getByText('Không có lời mời nhóm đang chờ', { exact: true }),
    ).toBeVisible();
    await api(`/api/chat-rooms/${room.id}/invite`, owner.token, { userId: guest.user.id });
    await expect(sessions[1].main.locator('.group-invitation')).toBeVisible();
    await sessions[1].main.screenshot({
      path: path.resolve(__dirname, '../../.runtime/group-invitation-preview.png'),
    });
    await sessions[1].main.getByRole('button', { name: 'Chấp nhận', exact: true }).click();
    await expect(
      sessions[1].main.getByRole('textbox', { name: `Nhắn tin trong # ${room.name}` }),
    ).toBeVisible();
    await expect(sessions[0].main.locator('.context-members .member')).toHaveCount(2);
  } finally {
    for (const session of sessions) {
      await close(session.app);
    }
  }
});
