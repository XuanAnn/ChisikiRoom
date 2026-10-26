const { test, expect, _electron } = require('@playwright/test');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const base = process.env.VERIFY_API_URL || 'http://localhost:18080';
async function api(route, token, body) {
  const r = await fetch(base + route, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    throw new Error(`${route}: ${r.status} ${await r.text()}`);
  }
  const text = await r.text();
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
async function login(app, account, password) {
  const page = await app.firstWindow();
  await page.getByLabel('Email', { exact: true }).fill(account.user.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.locator('.chat-workspace')).toBeVisible();
  return page;
}
async function open(app, page, room) {
  const next = app.waitForEvent('window', {
    predicate: async (page) => {
      await page.waitForURL((url) => !!url.hash);
      return page.url().includes('#call/');
    },
  });
  await page.evaluate((id) => window.chisiki.openWindow('call', id), room);
  const call = await next;
  await call.waitForLoadState('domcontentloaded');
  await expect(call.getByRole('button', { name: 'Bật camera', exact: true })).toBeEnabled();
  return call;
}
async function enable(page) {
  await page.getByRole('button', { name: 'Bật camera', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tắt camera', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Bật mic', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tắt mic', exact: true })).toBeVisible();
  await page.locator('video').evaluateAll((videos) => videos.forEach((v) => (v.volume = 0)));
}
async function videos(page, count) {
  await expect
    .poll(() =>
      page
        .locator('video')
        .evaluateAll((items) => items.filter((v) => v.videoWidth > 0 && !v.paused).length),
    )
    .toBe(count);
}

test('friend call invitation and three-person group P2P outside Battle', async () => {
  test.setTimeout(120000);
  const password = randomUUID();
  const accounts = [];
  for (const name of ['An Call', 'Bình Call', 'Chi Call']) {
    accounts.push(
      await api('/api/auth/register', null, {
        email: `call-${randomUUID()}@example.com`,
        password,
        displayName: name,
      }),
    );
  }
  const [a, b, c] = accounts;
  await api('/api/friend-requests', a.token, { userId: b.user.id });
  await api('/api/friend-requests/respond', b.token, { senderId: a.user.id, accept: true });
  const direct = await api('/api/chat-rooms/direct', a.token, { userId: b.user.id });
  const group = await api('/api/chat-rooms', a.token, {
    name: 'Nhóm gọi video',
    privateRoom: true,
  });
  for (const member of [b, c]) {
    await api(`/api/chat-rooms/${group.id}/invite`, a.token, { userId: member.user.id });
    await api(`/api/group-invitations/${group.id}/respond`, member.token, { accept: true });
  }
  const apps = [];
  try {
    for (let i = 0; i < 3; i++) {
      apps.push(await launch());
    }
    const pages = [];
    for (let i = 0; i < 3; i++) {
      pages.push(await login(apps[i], accounts[i], password));
    }
    const incomingWindow = apps[1].waitForEvent('window', {
      predicate: async (page) => {
        await page.waitForURL((url) => !!url.hash);
        return page.url().includes('#incoming/');
      },
    });
    await apps[1].evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize());
    const callA = await open(apps[0], pages[0], direct.id);
    const incoming = await incomingWindow;
    await incoming.waitForLoadState('domcontentloaded');
    await expect(
      incoming.getByRole('heading', { name: 'Cuộc gọi đến', exact: true }),
    ).toBeVisible();
    await expect(incoming.getByRole('button', { name: 'Tắt chuông', exact: true })).toBeVisible();
    await expect
      .poll(() =>
        apps[1].evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().some(
            (window) =>
              window.webContents.getURL().includes('#incoming/') &&
              window.webContents.isCurrentlyAudible(),
          ),
        ),
      )
      .toBe(true);
    await incoming.screenshot({
      path: path.resolve(__dirname, '../../.runtime/incoming-call-preview.png'),
    });
    await incoming.getByRole('button', { name: 'Tắt chuông', exact: true }).click();
    await expect(incoming.getByRole('button', { name: 'Bật chuông', exact: true })).toBeVisible();
    await expect
      .poll(() =>
        apps[1].evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().some(
            (window) =>
              window.webContents.getURL().includes('#incoming/') &&
              window.webContents.isCurrentlyAudible(),
          ),
        ),
      )
      .toBe(false);
    const next = apps[1].waitForEvent('window', {
      predicate: async (page) => {
        await page.waitForURL((url) => !!url.hash);
        return page.url().includes('#call/');
      },
    });
    await incoming.getByRole('button', { name: /Nhận cuộc gọi$/ }).click();
    const callB = await next;
    await callB.waitForLoadState('domcontentloaded');
    // No camera/mic is acquired merely by accepting.
    await expect(callB.getByRole('button', { name: 'Bật camera', exact: true })).toBeEnabled();
    expect(
      await callB.locator('video').evaluateAll((items) => items.every((v) => v.videoWidth === 0)),
    ).toBe(true);
    await enable(callA);
    await videos(callB, 1);
    await expect(callB.getByRole('button', { name: 'Phát video', exact: true })).toHaveCount(0);
    await callB.locator('.remote-video video').evaluate((element) => element.pause());
    await expect
      .poll(() => callB.locator('.remote-video video').evaluate((element) => !element.paused))
      .toBe(true);
    await enable(callB);
    await videos(callA, 2);
    await videos(callB, 2);
    await expect(callA.locator('.call-direct')).toBeVisible();
    const localPreview = await callA.locator('.self-preview').boundingBox();
    const remoteVideo = await callA.locator('.remote-video').boundingBox();
    expect(localPreview.width).toBeLessThan(remoteVideo.width / 2);
    expect(localPreview.height).toBeLessThan(remoteVideo.height);
    await callA.screenshot({
      path: path.resolve(__dirname, '../../.runtime/direct-call-preview.png'),
    });

    await callB.getByRole('button', { name: 'Tắt camera', exact: true }).click();
    await expect(callB.getByRole('button', { name: 'Bật camera', exact: true })).toBeVisible();
    await expect
      .poll(() =>
        callA
          .locator('video')
          .evaluateAll((items) =>
            items.some((v) => !v.muted && v.srcObject?.getAudioTracks().some((t) => !t.muted)),
          ),
      )
      .toBe(true);
    await callB.getByRole('button', { name: 'Rời cuộc gọi', exact: true }).click();
    await expect(callA.getByRole('heading', { name: 'Cuộc gọi đã kết thúc' })).toBeVisible();
    const rejectedPopupPromise = apps[0].waitForEvent('window', {
      predicate: async (page) => {
        await page.waitForURL((url) => !!url.hash);
        return page.url().includes('#incoming/');
      },
    });
    const rejectedCaller = await open(apps[1], pages[1], direct.id);
    const rejectedPopup = await rejectedPopupPromise;
    await rejectedPopup.getByRole('button', { name: 'Từ chối', exact: true }).click();
    await expect(
      rejectedCaller.getByRole('heading', { name: 'Cuộc gọi đã kết thúc' }),
    ).toBeVisible();
    const cancelledPopupPromise = apps[1].waitForEvent('window', {
      predicate: async (page) => {
        await page.waitForURL((url) => !!url.hash);
        return page.url().includes('#incoming/');
      },
    });
    const cancelledCaller = await open(apps[0], pages[0], direct.id);
    const cancelledPopup = await cancelledPopupPromise;
    await expect(
      cancelledPopup.getByRole('heading', { name: 'Cuộc gọi đến', exact: true }),
    ).toBeVisible();
    await cancelledCaller.getByRole('button', { name: 'Rời cuộc gọi', exact: true }).click();
    await expect.poll(() => cancelledPopup.isClosed()).toBe(true);
    // Reverse the UUID offer/answer roles and keep A in receive-only mode.
    const reverseB = await open(apps[1], pages[1], direct.id);
    const reverseA = await open(apps[0], pages[0], direct.id);
    await enable(reverseB);
    await videos(reverseA, 1);
    await reverseB.getByRole('button', { name: 'Rời cuộc gọi', exact: true }).click();
    await expect(reverseA.getByRole('heading', { name: 'Cuộc gọi đã kết thúc' })).toBeVisible();
    const groupCalls = [];
    for (let i = 0; i < 3; i++) {
      groupCalls.push(await open(apps[i], pages[i], group.id));
    }
    for (const page of groupCalls) {
      await enable(page);
    }
    for (const page of groupCalls) {
      await videos(page, 3);
    }
    await expect(groupCalls[0].locator('.call-group')).toBeVisible();
    const remoteTiles = await groupCalls[0].locator('.remote-video').all();
    const firstRemote = await remoteTiles[0].boundingBox();
    const secondRemote = await remoteTiles[1].boundingBox();
    expect(Math.abs(firstRemote.y - secondRemote.y)).toBeLessThan(2);
    expect(secondRemote.x).toBeGreaterThan(firstRemote.x + firstRemote.width);
    await groupCalls[0].setViewportSize({ width: 620, height: 600 });
    const smallLocal = await groupCalls[0].locator('.self-preview').boundingBox();
    expect(smallLocal.width).toBeLessThanOrEqual(140);
    await groupCalls[0].setViewportSize({ width: 1100, height: 780 });
    await groupCalls[0].screenshot({
      path: path.resolve(__dirname, '../../.runtime/group-call-preview.png'),
    });
    await groupCalls[0].getByRole('button', { name: 'Rời cuộc gọi', exact: true }).click();
    await expect(groupCalls[1].getByText('2/4 người', { exact: true })).toBeVisible();
    await groupCalls[1].getByRole('button', { name: 'Rời cuộc gọi', exact: true }).click();
    await groupCalls[2].getByRole('button', { name: 'Rời cuộc gọi', exact: true }).click();
    await expect(
      groupCalls[2].getByRole('heading', { name: 'Cuộc gọi đã kết thúc' }),
    ).toBeVisible();
    await expect.poll(() => api(`/api/chat-rooms/${group.id}/call`, a.token)).toBe(null);
  } catch (error) {
    let i = 0;
    for (const app of apps) {
      for (const page of app.windows()) {
        const info = await page
          .evaluate(() => ({
            text: document.body.innerText,
            media: [...document.querySelectorAll('video')].map((v) => ({
              width: v.videoWidth,
              paused: v.paused,
              tracks: v.srcObject
                ?.getTracks()
                .map((t) => ({ kind: t.kind, muted: t.muted, state: t.readyState })),
            })),
            peers: [...(window.__mediaPeers || [])].map(([id, p]) => ({
              id,
              state: p.pc.connectionState,
              signaling: p.pc.signalingState,
              local: p.pc.localDescription?.sdp,
              remote: p.pc.remoteDescription?.sdp,
              transceivers: p.pc.getTransceivers().map((t) => ({
                direction: t.direction,
                current: t.currentDirection,
                sender: t.sender.track?.kind,
                receiver: t.receiver.track.kind,
              })),
            })),
          }))
          .catch(() => null);
        await require('node:fs/promises').writeFile(
          path.resolve(__dirname, `../../.runtime/call-debug-${i++}.json`),
          JSON.stringify(info, null, 2),
        );
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
