const { test, expect } = require('@playwright/test');
const http = require('node:http');
const { WebSocketServer } = require('ws');

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'web@example.com',
  displayName: 'An Web',
};
const roomId = '00000000-0000-4000-8000-000000000002';
const callId = '00000000-0000-4000-8000-000000000003';
const documentId = '00000000-0000-4000-8000-000000000004';
const peerId = '00000000-0000-4000-8000-000000000005';
const room = {
  id: roomId,
  name: 'Nhóm kiểm thử web',
  privateRoom: false,
  ownerId: user.id,
  joined: true,
  memberCount: 2,
  kind: 'GROUP',
  peerId: null,
  myRole: 'OWNER',
};
const requests = [];
let server;
let sockets;
let documents;
let subscriptions;
const messages = [];

function publish(event) {
  for (const [socket, subscription] of subscriptions) {
    socket.send(
      `MESSAGE\nsubscription:${subscription}\nmessage-id:${Date.now()}\ndestination:/user/queue/events\n\n${JSON.stringify(event)}\0`,
    );
  }
}

test.beforeAll(async () => {
  subscriptions = new Map();
  documents = [];
  server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString();
    requests.push({
      path: request.url,
      method: request.method,
      authorization: request.headers.authorization,
      raw,
    });
    const send = (data, status = 200) => {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(data));
    };
    const call = {
      id: callId,
      roomId,
      callerId: peerId,
      status: 'ACTIVE',
      sequence: 1,
      participants: [{ ...user, camera: false }],
    };
    if (request.url === '/actuator/health') {
      return send({ status: 'UP' });
    }
    if (request.url === '/api/auth/login') {
      return send({ token: 'web-test-token', user });
    }
    if (request.headers.authorization !== 'Bearer web-test-token') {
      return send({ message: 'Unauthorized' }, 401);
    }
    if (request.url === '/api/auth/me') {
      return send(user);
    }
    if (request.url === '/api/auth/logout') {
      return send({});
    }
    if (request.url === '/api/chat-rooms') {
      return send([room]);
    }
    if (request.url === `/api/chat-rooms/${roomId}/members`) {
      return send([{ ...user, role: 'OWNER' }]);
    }
    if (request.url === '/api/chat-rooms/state') {
      return send([]);
    }
    if (request.url === `/api/chat-rooms/${roomId}/messages`) {
      if (request.method === 'POST') {
        const payload = JSON.parse(raw);
        const message = {
          ...payload,
          id: messages.length + 1,
          roomId,
          senderId: user.id,
          displayName: user.displayName,
          createdAt: new Date().toISOString(),
          revision: 0,
        };
        messages.push(message);
        publish({ type: 'MESSAGE_CREATED', data: message });
        return send(message);
      }
      return send(messages);
    }
    if (request.url === `/api/chat-rooms/${roomId}/call`) {
      return send(null);
    }
    if (request.url.startsWith(`/api/calls/${callId}/ice-servers`)) {
      return send({ iceServers: [] });
    }
    if (request.url.startsWith(`/api/calls/${callId}`)) {
      return send(call);
    }
    if (request.url === '/api/documents' && request.method === 'POST') {
      documents.push({
        id: documentId,
        filename: 'web-note.txt',
        sizeBytes: 8,
        createdAt: new Date().toISOString(),
      });
      return send(documents[0], 201);
    }
    if (request.url.startsWith('/api/documents?')) {
      return send(documents);
    }
    if (request.url === `/api/documents/${documentId}/download`) {
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      return response.end('web file');
    }
    if (request.url.startsWith('/api/profile/') && request.url.endsWith('/avatar')) {
      return send({}, 404);
    }
    if (request.url.includes('/state/')) {
      return send({ version: 1, content: '' });
    }
    return send([]);
  });
  sockets = new WebSocketServer({ server, path: '/ws' });
  sockets.on('connection', (socket) => {
    socket.on('message', (bytes) => {
      const frame = bytes.toString();
      if (frame.startsWith('CONNECT')) {
        expect(frame).toContain('Authorization:Bearer web-test-token');
        socket.send('CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0');
      }
      if (frame.startsWith('SUBSCRIBE')) {
        subscriptions.set(socket, /\nid:([^\n]+)/.exec(frame)[1]);
      }
    });
    socket.on('close', () => subscriptions.delete(socket));
  });
  await new Promise((resolve) => server.listen(18190, '127.0.0.1', resolve));
});

test.afterAll(async () => {
  for (const socket of sockets.clients) {
    socket.terminate();
  }
  await new Promise((resolve) => sockets.close(resolve));
  await new Promise((resolve) => server.close(resolve));
});

test('browser reuses desktop UI with REST, STOMP, tools, files and incoming calls', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: /Máy chủ$/ }).click();
  await page.getByRole('button', { name: 'Kiểm tra kết nối', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Backend đang hoạt động');
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.locator('.chat-workspace')).toBeVisible();
  await expect.poll(() => subscriptions.size).toBe(1);
  expect(await page.evaluate(() => window.chisiki.platform)).toBe('web');
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();

  // Exercise a real event over the dev server's WebSocket proxy.
  const received = page.evaluate(
    () =>
      new Promise((resolve) => {
        const unsubscribe = window.chisiki.onEvent((event) => {
          if (event.type === 'WEB_TEST_EVENT') {
            unsubscribe();
            resolve(event.data.message);
          }
        });
        window.testListenerReady = true;
      }),
  );
  await expect.poll(() => page.evaluate(() => window.testListenerReady)).toBe(true);
  for (const [socket, subscription] of subscriptions) {
    socket.send(
      `MESSAGE\nsubscription:${subscription}\nmessage-id:test\ndestination:/user/queue/events\n\n${JSON.stringify({ type: 'WEB_TEST_EVENT', data: { message: 'Realtime OK' } })}\0`,
    );
  }
  expect(await received).toBe('Realtime OK');

  await page
    .getByRole('button', { name: /Nhóm kiểm thử web/ })
    .first()
    .click();
  await page.getByPlaceholder('Nhắn tin trong # Nhóm kiểm thử web').fill('Tin nhắn từ web');
  await page.getByPlaceholder('Nhắn tin trong # Nhóm kiểm thử web').press('Enter');
  await expect(page.locator('.message-list')).toContainText('Tin nhắn từ web');
  publish({
    type: 'MESSAGE_CREATED',
    data: {
      id: 99,
      roomId,
      senderId: peerId,
      displayName: 'Bạn Web',
      content: 'Tin realtime nhận được',
      requestId: 'remote',
      createdAt: new Date().toISOString(),
      revision: 0,
    },
  });
  await expect(page.locator('.message-list')).toContainText('Tin realtime nhận được');

  await page.evaluate(() => window.chisiki.openWindow('quiz'));
  await expect(page.getByRole('region', { name: 'Cửa sổ chức năng' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Lưu/ })).toBeVisible();
  await page.getByRole('button', { name: 'Quay về trò chuyện', exact: true }).click();
  await expect(page.locator('.chat-workspace')).toBeVisible();

  const chooser = page.waitForEvent('filechooser');
  const upload = page.evaluate((id) => window.chisiki.uploadDocument(id), roomId);
  await (
    await chooser
  ).setFiles({ name: 'web-note.txt', mimeType: 'text/plain', buffer: Buffer.from('web file') });
  expect((await upload).data.id).toBe(documentId);
  const download = page.waitForEvent('download');
  await page.evaluate(({ id }) => window.chisiki.downloadDocument(id, 'web-note.txt'), {
    id: documentId,
  });
  expect((await download).suggestedFilename()).toBe('web-note.txt');

  await page.evaluate((id) => window.chisiki.notifyIncoming(id), callId);
  await expect(page.getByRole('heading', { name: 'Cuộc gọi đến', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Nhận cuộc gọi/ }).click();
  await expect(page.locator('.call-window')).toBeVisible();
  await page.getByRole('button', { name: 'Quay về trò chuyện', exact: true }).click();
  await expect(page.locator('.chat-workspace')).toBeVisible();
  expect(requests.some((request) => request.path === `/api/calls/${callId}/leave`)).toBe(true);
  expect(
    requests.some(
      (request) => request.path === '/api/documents' && request.raw.includes('web file'),
    ),
  ).toBe(true);
  expect(errors).toEqual([]);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible();
  await expect(page.locator('.chat-workspace')).toHaveCount(0);
});
