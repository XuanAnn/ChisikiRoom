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
async function joinWindow(app, kind) {
  return app.waitForEvent('window', {
    predicate: async (page) => {
      await page.waitForURL((url) => !!url.hash);
      return page.url().includes(`#${kind}/`);
    },
  });
}
test('group roles, call revocation, unblocking and owner transfer work through the UI', async () => {
  const password = randomUUID();
  const owner = await account(password, 'Group Manager');
  const guest = await account(password, 'Group Admin');
  const room = await api('/api/chat-rooms', owner.token, {
    name: 'Nhóm quản trị',
    privateRoom: false,
  });
  await api(`/api/chat-rooms/${room.id}/join`, guest.token, {});
  const sessions = [];
  try {
    const first = await launch(owner, password);
    sessions.push(first);
    const second = await launch(guest, password);
    sessions.push(second);
    await first.main.getByRole('button', { name: 'Quản lý nhóm', exact: true }).click();
    await first.main.getByRole('tab', { name: 'Thành viên (2)', exact: true }).click();
    const guestRow = first.main
      .locator('.group-manager-member')
      .filter({ has: first.main.getByRole('heading', { name: 'Group Admin', exact: true }) });
    await guestRow.getByRole('button', { name: 'Cấp quản trị', exact: true }).click();
    await expect(
      second.main.getByRole('button', { name: 'Quản lý nhóm', exact: true }),
    ).toBeVisible();
    await second.main.getByRole('button', { name: 'Quản lý nhóm', exact: true }).click();
    await expect(
      second.main.getByRole('checkbox', { name: 'Nhóm riêng tư', exact: true }),
    ).toBeDisabled();
    await second.main
      .getByRole('textbox', { name: 'Tên nhóm mới', exact: true })
      .fill('Nhóm đã đổi tên');
    await second.main.getByRole('button', { name: 'Lưu thông tin nhóm', exact: true }).click();
    await expect(first.main.locator('.workspace-heading strong')).toHaveText('Nhóm đã đổi tên');
    await second.main.locator('.ant-drawer-close').click();
    const incomingPromise = joinWindow(second.app, 'incoming');
    await api(`/api/chat-rooms/${room.id}/call`, owner.token, {});
    const incoming = await incomingPromise;
    const callPromise = joinWindow(second.app, 'call');
    await incoming.getByRole('button', { name: /Nhận cuộc gọi$/ }).click();
    const callWindow = await callPromise;
    await callWindow.getByRole('button', { name: 'Bật camera', exact: true }).click();
    await expect(callWindow.getByRole('button', { name: 'Tắt camera', exact: true })).toBeVisible();
    await guestRow.getByRole('button', { name: 'Chặn khỏi nhóm', exact: true }).click();
    await first.main.getByRole('button', { name: 'Xác nhận', exact: true }).click();
    await expect(
      callWindow.getByRole('heading', { name: 'Cuộc gọi đã kết thúc', exact: true }),
    ).toBeVisible();
    await expect(callWindow.locator('video')).toHaveCount(0);
    await expect
      .poll(async () =>
        (await api('/api/chat-rooms', guest.token)).some((item) => item.id === room.id),
      )
      .toBe(false);
    await first.main.getByRole('tab', { name: 'Bị chặn (1)', exact: true }).click();
    await first.main.getByRole('button', { name: 'Bỏ chặn', exact: true }).click();
    await expect(first.main.getByRole('tab', { name: 'Bị chặn (0)', exact: true })).toBeVisible();
    await api(`/api/chat-rooms/${room.id}/join`, guest.token, {});
    await first.main.getByRole('tab', { name: 'Thành viên (2)', exact: true }).click();
    await guestRow.getByRole('button', { name: 'Chuyển chủ nhóm', exact: true }).click();
    await first.main.getByRole('button', { name: 'Xác nhận', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await api('/api/chat-rooms', owner.token)).find((item) => item.id === room.id).ownerId,
      )
      .toBe(guest.user.id);
    await expect(guestRow.getByText('Chủ nhóm', { exact: true })).toBeVisible();
    await expect(first.main.locator('.ant-modal-confirm')).toBeHidden();
    await first.main.screenshot({
      path: path.resolve(__dirname, '../../.runtime/group-management-preview.png'),
    });
    await first.main.locator('.ant-drawer-close').click();
    await expect(first.main.locator('.ant-drawer-body')).toBeHidden();
    await api(`/api/chat-rooms/${room.id}/messages`, owner.token, {
      content: 'Giữ bố cục cũ, màu xám đậm và xanh tím.',
      requestId: randomUUID(),
    });
    await api(`/api/chat-rooms/${room.id}/messages`, guest.token, {
      content: 'Màu mới dễ nhìn hơn, vẫn đầy đủ chức năng.',
      requestId: randomUUID(),
    });
    await expect(first.main.locator('.message p')).toHaveCount(2);
    await first.main.screenshot({
      path: path.resolve(__dirname, '../../.runtime/discord-colors-preview.png'),
    });
  } finally {
    for (const session of sessions) {
      await close(session.app);
    }
  }
});
