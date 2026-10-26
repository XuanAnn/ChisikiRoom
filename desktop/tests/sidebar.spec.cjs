const { test, expect, _electron } = require('@playwright/test');
const http = require('node:http');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

test('friend and group chat lists scroll independently without scrollbars', async () => {
  const user = { id: randomUUID(), email: 'sidebar@example.com', displayName: 'An kiểm tra' };
  const friends = Array.from({ length: 40 }, (_, i) => ({
    id: randomUUID(),
    displayName: `Bạn ${String(i + 1).padStart(2, '0')}`,
    online: i % 2 === 0,
  }));
  const groups = Array.from({ length: 40 }, (_, i) => ({
    id: randomUUID(),
    name: `Nhóm ${String(i + 1).padStart(2, '0')}`,
    ownerId: user.id,
    privateRoom: i % 2 === 0,
    joined: true,
    memberCount: 3,
    kind: 'GROUP',
    peerId: null,
  }));
  const rooms = [...groups];
  let rejectNextDirect = true;
  let validSession = true;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }
    const send = (data, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    if (url.pathname === '/api/auth/login') {
      return send({ token: 'sidebar-test-session', user, expiresAt: '2099-01-01T00:00:00Z' });
    }
    if (url.pathname === '/api/auth/me') {
      return validSession ? send(user) : send({ message: 'Expired' }, 401);
    }
    if (url.pathname === '/api/friends') {
      return send(friends);
    }
    if (url.pathname === '/api/chat-rooms/direct') {
      if (rejectNextDirect) {
        rejectNextDirect = false;
        return send({ message: 'Legacy endpoint error' }, 401);
      }
      const peer = friends.find((f) => f.id === JSON.parse(body).userId);
      if (!peer) {
        return send({ message: 'Not a friend' }, 403);
      }
      let room = rooms.find((r) => r.kind === 'DIRECT' && r.peerId === peer.id);
      if (!room) {
        room = {
          id: randomUUID(),
          name: peer.displayName,
          privateRoom: true,
          joined: true,
          memberCount: 2,
          kind: 'DIRECT',
          peerId: peer.id,
          ownerId: user.id,
        };
        rooms.push(room);
      }
      return send(room);
    }
    if (url.pathname === '/api/chat-rooms') {
      return send(rooms);
    }
    if (url.pathname.endsWith('/call')) {
      return send(null);
    }
    if (url.pathname.endsWith('/avatar')) {
      return send({}, 404);
    }
    if (url.pathname.endsWith('/members')) {
      return send([
        { id: user.id, displayName: user.displayName },
        { id: friends[0].id, displayName: friends[0].displayName },
      ]);
    }
    return send([]);
  });
  server.on('upgrade', (_req, socket) => socket.destroy());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const env = { ...process.env, CHISIKI_API_URL: `http://127.0.0.1:${server.address().port}` };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.CHISIKI_DEV;
  const app = await _electron.launch({
    ...(process.env.VERIFY_EXECUTABLE
      ? { executablePath: process.env.VERIFY_EXECUTABLE, args: [] }
      : { args: [path.resolve(__dirname, '..')] }),
    env,
  });
  try {
    const page = await app.firstWindow();
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill('sidebar-test-password');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    const friendList = page.getByRole('region', { name: 'Danh sách chat bạn bè' });
    const groupList = page.getByRole('region', { name: 'Danh sách chat nhóm' });
    await expect(friendList.getByRole('button')).toHaveCount(40);
    await expect(groupList.getByRole('button')).toHaveCount(40);
    const friendBounds = await friendList.boundingBox();
    const groupBounds = await groupList.boundingBox();
    expect(friendBounds.y + friendBounds.height).toBeLessThan(groupBounds.y);
    await friendList.getByRole('button', { name: 'Chat với Bạn 01', exact: true }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Máy chủ chưa mở được chat riêng' }),
    ).toBeVisible();
    await expect(friendList).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toHaveCount(0);
    await friendList.getByRole('button', { name: 'Chat với Bạn 01', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Nhắn tin cho Bạn 01' })).toBeVisible();
    await expect(groupList.getByRole('button')).toHaveCount(40);
    await expect(page.getByRole('button', { name: 'Rời phòng', exact: true })).toHaveCount(0);
    await page.getByRole('textbox', { name: 'Nhắn tin cho Bạn 01' }).fill('Bản nháp riêng');
    await groupList.getByRole('button', { name: /Nhóm 01/ }).click();
    await page.getByRole('textbox', { name: 'Nhắn tin trong # Nhóm 01' }).fill('Ghi chú cho nhóm');
    await friendList.getByRole('button', { name: 'Chat với Bạn 01', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Nhắn tin cho Bạn 01' })).toHaveValue(
      'Bản nháp riêng',
    );
    await groupList.getByRole('button', { name: /Nhóm 01/ }).click();
    await expect(page.getByRole('textbox', { name: 'Nhắn tin trong # Nhóm 01' })).toHaveValue(
      'Ghi chú cho nhóm',
    );
    const directRoom = rooms.find((room) => room.kind === 'DIRECT');
    await app.evaluate(
      ({ BrowserWindow }, incoming) =>
        BrowserWindow.getAllWindows()[0].webContents.send('event', incoming),
      {
        type: 'MESSAGE_CREATED',
        data: {
          id: 1001,
          roomId: directRoom.id,
          senderId: friends[0].id,
          displayName: 'Bạn 01',
          content: 'Tin mới',
          createdAt: new Date().toISOString(),
          requestId: randomUUID(),
        },
      },
    );
    await expect(friendList.locator('.unread-badge')).toHaveText('1');
    await friendList.getByRole('button', { name: 'Chat với Bạn 01', exact: true }).click();
    await expect(friendList.locator('.unread-badge')).toHaveCount(0);
    await page.getByRole('button', { name: /Tổng quan$/ }).click();
    await expect(page.getByRole('heading', { name: /Học điều mới/ })).toBeVisible();
    await page.screenshot({ path: path.resolve(__dirname, '../../.runtime/overview-preview.png') });
    await page.getByRole('textbox', { name: 'Tìm bạn bè và nhóm' }).fill('nhom 40');
    await expect(groupList.getByRole('button')).toHaveCount(1);
    await page.getByRole('textbox', { name: 'Tìm bạn bè và nhóm' }).fill('');
    await page.getByRole('button', { name: /Phòng trò chuyện$/ }).click();
    for (const list of [friendList, groupList]) {
      const dimensions = await list.evaluate((element) => ({
        client: element.clientHeight,
        scroll: element.scrollHeight,
        width: element.offsetWidth - element.clientWidth,
        hidden: getComputedStyle(element).scrollbarWidth === 'none',
        webkit: getComputedStyle(element, '::-webkit-scrollbar').display,
      }));
      expect(dimensions.scroll).toBeGreaterThan(dimensions.client);
      expect(dimensions.client).toBeGreaterThan(50);
      expect(dimensions.width).toBe(0);
      expect(dimensions.hidden || dimensions.webkit === 'none').toBeTruthy();
    }
    await friendList.hover();
    await page.mouse.wheel(0, 650);
    await expect.poll(() => friendList.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(await groupList.evaluate((element) => element.scrollTop)).toBe(0);
    const previousFriendScroll = await friendList.evaluate((element) => element.scrollTop);
    await groupList.hover();
    await page.mouse.wheel(0, 650);
    await expect.poll(() => groupList.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(await friendList.evaluate((element) => element.scrollTop)).toBe(previousFriendScroll);
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setContentSize(900, 650),
    );
    await expect(friendList).toBeVisible();
    await expect(groupList).toBeVisible();
    const footer = page.locator('.chat-sidebar-footer');
    await expect(footer).toBeInViewport();
    await page.screenshot({ path: path.resolve(__dirname, '../../.runtime/sidebar-preview.png') });
    rejectNextDirect = true;
    validSession = false;
    await friendList.getByRole('button', { name: 'Chat với Bạn 02', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible();
  } finally {
    await app
      .evaluate(({ BrowserWindow }) => {
        for (const window of BrowserWindow.getAllWindows()) {
          window.destroy();
        }
      })
      .catch(() => {});
    await app.close().catch(() => {});
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
