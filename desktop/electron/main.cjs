const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { Client } = require('@stomp/stompjs');
const WebSocket = require('ws');
const { sessionExpired } = require('./session.cjs');
const { normalizeServerUrl, checkServerConnection } = require('./server-connection.cjs');
const { createIncomingCalls } = require('./incoming-calls.cjs');
let apiUrl = process.env.CHISIKI_API_URL || 'http://localhost:8080';
let token;
let currentUser;
let realtime;
let connection = 'offline';
let activeCall;
let openingCall = false;
const windows = new Map();
const dirtyWindows = new Set();
const incomingCalls = createIncomingCalls({
  getSession: () => ({ token, apiUrl, user: currentUser }),
  canAccept: () =>
    Boolean(token && currentUser) &&
    !activeCall &&
    !openingCall &&
    ![...windows.keys()].some((key) => key.startsWith('battle:')),
  reserve: () => {
    openingCall = true;
    return () => {
      openingCall = false;
    };
  },
  createWindow: (callId) => openWindow('incoming', callId),
  onAccepted: (callId) => {
    activeCall = callId;
    openWindow('call', callId);
  },
});
const uuid = (value) =>
  typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
function broadcast(event) {
  for (const win of windows.values()) {
    if (!win.isDestroyed()) {
      win.webContents.send('event', event);
    }
  }
}
function connectRealtime() {
  if (realtime) {
    void realtime.deactivate();
  }
  const client = new Client({
    webSocketFactory: () => new WebSocket(apiUrl.replace(/^http/, 'ws') + '/ws'),
    connectHeaders: { Authorization: `Bearer ${token}` },
    reconnectDelay: 2000,
    connectionTimeout: 10000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: () => {
      client.subscribe('/user/queue/events', (message) => {
        try {
          const event = JSON.parse(message.body);
          if (event.type === 'CALL_ENDED' && event.data.callId === activeCall) {
            activeCall = undefined;
          }
          incomingCalls.observe(event);
          broadcast(event);
        } catch {}
      });
      connection = 'online';
      broadcast({ type: 'CONNECTION', data: connection });
    },
    onWebSocketClose: () => {
      connection = 'offline';
      broadcast({ type: 'CONNECTION', data: connection });
    },
    onStompError: () => {
      connection = 'offline';
      broadcast({ type: 'CONNECTION', data: connection });
    },
  });
  realtime = client;
  client.activate();
}
function authorized(event) {
  return [...windows.values()].some(
    (win) =>
      !win.isDestroyed() &&
      event.sender === win.webContents &&
      event.senderFrame === win.webContents.mainFrame,
  );
}
const routesReady = import('./api-routes.mjs');
ipcMain.handle('api', async (event, action, body) => {
  if (!authorized(event)) {
    return { error: 'Yêu cầu không hợp lệ' };
  }
  try {
    const { route } = await routesReady;
    const [method, endpoint] = route(action, body);
    const requestToken = token;
    const requestApiUrl = apiUrl;
    const { id, messageId, ...payload } = body || {};
    const response = await fetch(requestApiUrl + endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}),
      },
      body: method !== 'GET' && body ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {}
    if (!response.ok) {
      if (response.status === 401 && action !== 'login' && action !== 'register') {
        const expired = action === 'me' || (await sessionExpired(requestApiUrl, requestToken));
        if (expired && requestToken === token && requestApiUrl === apiUrl) {
          token = undefined;
          currentUser = undefined;
          incomingCalls.reset();
          if (realtime) {
            void realtime.deactivate();
          }
          broadcast({ type: 'SIGNED_OUT', data: null });
          return { error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' };
        }
        return {
          error:
            action === 'openDirect'
              ? 'Máy chủ chưa mở được chat riêng. Hãy cập nhật và khởi động lại backend, rồi thử lại.'
              : 'Yêu cầu bị từ chối nhưng chưa xác nhận phiên hết hạn. Vui lòng thử lại.',
        };
      }
      if (action === 'openDirect' && (response.status === 404 || response.status === 405)) {
        return { error: 'Backend chưa hỗ trợ chat riêng. Hãy cập nhật và khởi động lại backend.' };
      }
      return { error: data?.message || `Yêu cầu thất bại (${response.status})` };
    }
    if (action === 'login' || action === 'register') {
      incomingCalls.reset();
      currentUser = data.user;
      token = data.token;
      delete data.token;
      connectRealtime();
    }
    if (action === 'logout') {
      currentUser = undefined;
      incomingCalls.reset();
      activeCall = undefined;
      token = undefined;
      if (realtime) {
        void realtime.deactivate();
      }
      for (const [key, win] of windows) {
        if (key !== 'main') {
          dirtyWindows.delete(win.id);
          win.destroy();
        }
      }
      broadcast({ type: 'SIGNED_OUT', data: null });
    }
    if (action === 'leaveCall' && body?.id === activeCall) {
      activeCall = undefined;
      incomingCalls.resume();
    }
    return { data };
  } catch (e) {
    return {
      error:
        e instanceof TypeError || e.name === 'TimeoutError'
          ? 'Không kết nối được máy chủ. Kiểm tra backend và địa chỉ kết nối.'
          : e.message,
    };
  }
});
ipcMain.handle('incoming-notify', (event, callId) => {
  if (authorized(event) && uuid(callId)) {
    incomingCalls.notify(callId);
  }
});
ipcMain.handle('incoming-response', (event, callId, decision) => {
  if (!authorized(event) || !uuid(callId)) {
    return { error: 'Yêu cầu không hợp lệ.' };
  }
  return incomingCalls.respond(event.sender, callId, decision);
});
ipcMain.handle('open-window', async (event, kind, id) => {
  if (
    !authorized(event) ||
    !token ||
    !['quiz', 'battle', 'call', 'practice'].includes(kind) ||
    (id && !uuid(id)) ||
    (['battle', 'call', 'practice'].includes(kind) && !id)
  ) {
    return;
  }
  if (kind === 'call') {
    if (openingCall) {
      throw new Error('Đang mở cuộc gọi. Vui lòng chờ.');
    }
    if (activeCall) {
      const prior = windows.get(`call:${activeCall}`);
      if (prior && !prior.isDestroyed()) {
        prior.show();
        prior.focus();
        return;
      }
    }
    if ([...windows.keys()].some((key) => key.startsWith('battle:'))) {
      throw new Error('Hãy đóng cửa sổ Battle trước khi gọi video.');
    }
    openingCall = true;
    try {
      const response = await fetch(apiUrl + `/api/chat-rooms/${id}/call`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Không mở được cuộc gọi');
      }
      activeCall = data.id;
      openWindow('call', data.id);
    } finally {
      openingCall = false;
    }
    return;
  }
  if (kind === 'battle' && (activeCall || openingCall)) {
    throw new Error('Hãy rời cuộc gọi trước khi vào Battle.');
  }
  openWindow(kind, id);
});
ipcMain.handle('connection', (event) => (authorized(event) ? connection : 'offline'));
ipcMain.handle('avatar', async (event, userId) => {
  if (!authorized(event) || !token || !uuid(userId)) {
    return null;
  }
  try {
    const response = await fetch(apiUrl + `/api/profile/${userId}/avatar`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    });
    if (!response.ok) {
      return null;
    }
    const type = response.headers.get('content-type');
    if (!['image/png', 'image/jpeg'].includes(type)) {
      return null;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    return bytes.length <= 2 * 1024 * 1024
      ? `data:${type};base64,${bytes.toString('base64')}`
      : null;
  } catch {
    return null;
  }
});
ipcMain.handle('upload-avatar', async (event) => {
  if (!authorized(event) || !token) {
    return { error: 'Hãy đăng nhập trước' };
  }
  try {
    const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
      properties: ['openFile'],
      filters: [{ name: 'Avatar PNG/JPEG', extensions: ['png', 'jpg', 'jpeg'] }],
    });
    if (result.canceled) {
      return { data: null };
    }
    const file = result.filePaths[0];
    if ((await fs.stat(file)).size > 2 * 1024 * 1024) {
      return { error: 'Avatar tối đa 2 MB' };
    }
    const form = new FormData();
    form.set('file', new Blob([await fs.readFile(file)]), path.basename(file));
    const response = await fetch(apiUrl + '/api/profile/avatar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: AbortSignal.timeout(30000),
      redirect: 'error',
    });
    return response.ok
      ? { data: true }
      : { error: (await response.json()).message || 'Không lưu được avatar' };
  } catch {
    return { error: 'Không tải được avatar lên' };
  }
});
ipcMain.handle('server-check', async (event, value) => {
  if (!authorized(event) || token) {
    return { error: 'Hãy đăng xuất trước khi kiểm tra máy chủ khác' };
  }

  return checkServerConnection(value);
});
ipcMain.handle('server-settings', async (event, value) => {
  if (!authorized(event)) {
    return { error: 'Yêu cầu không hợp lệ' };
  }
  if (value === undefined) {
    return { data: apiUrl };
  }
  if (token) {
    return { error: 'Hãy đăng xuất trước khi đổi máy chủ' };
  }
  try {
    const serverUrl = normalizeServerUrl(value);
    await fs.mkdir(app.getPath('userData'), { recursive: true });
    await fs.writeFile(
      path.join(app.getPath('userData'), 'server.json'),
      JSON.stringify({ apiUrl: serverUrl }),
    );
    apiUrl = serverUrl;
    return { data: apiUrl };
  } catch {
    return { error: 'Nhập địa chỉ dạng http://IP-máy-chủ:8080 hoặc https://tên-miền' };
  }
});
ipcMain.handle('upload-document', async (event, roomId) => {
  if (!authorized(event) || !token || !uuid(roomId)) {
    return { error: 'Không có quyền tải lên' };
  }
  try {
    const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
      properties: ['openFile'],
      filters: [
        {
          name: 'Tài liệu và ảnh',
          extensions: ['pdf', 'docx', 'pptx', 'txt', 'png', 'jpg', 'jpeg'],
        },
      ],
    });
    if (result.canceled) {
      return { data: null };
    }
    const file = result.filePaths[0];
    const stat = await fs.stat(file);
    if (stat.size > 20 * 1024 * 1024) {
      return { error: 'File tối đa 20 MB' };
    }
    const form = new FormData();
    form.set('roomId', roomId);
    form.set('file', new Blob([await fs.readFile(file)]), path.basename(file));
    const response = await fetch(apiUrl + '/api/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: AbortSignal.timeout(60000),
      redirect: 'error',
    });
    const data = await response.json();
    return response.ok ? { data } : { error: data.message || 'Không tải được file lên máy chủ' };
  } catch {
    return { error: 'Không tải được file lên máy chủ' };
  }
});
ipcMain.handle('download-document', async (event, id, filename) => {
  if (!authorized(event) || !token || !uuid(id) || typeof filename !== 'string') {
    return { error: 'Không có quyền tải file' };
  }
  try {
    const result = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
      defaultPath: path.basename(filename).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_'),
    });
    if (result.canceled) {
      return { data: null };
    }
    const response = await fetch(apiUrl + `/api/documents/${id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(60000),
      redirect: 'error',
    });
    if (!response.ok) {
      return { error: `Không tải được file (${response.status})` };
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 20 * 1024 * 1024) {
      return { error: 'File vượt giới hạn 20 MB' };
    }
    await fs.writeFile(result.filePath, bytes);
    return { data: true };
  } catch {
    return { error: 'Không lưu được file' };
  }
});
ipcMain.on('dirty', (event, dirty) => {
  if (authorized(event)) {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (dirty) {
      dirtyWindows.add(win.id);
    } else {
      dirtyWindows.delete(win.id);
    }
  }
});
function openWindow(kind = 'main', id) {
  const key = kind === 'main' ? 'main' : `${kind}:${id || 'new'}`;
  const prior = windows.get(key);
  if (prior && !prior.isDestroyed()) {
    prior.show();
    prior.focus();
    return prior;
  }
  const isIncoming = kind === 'incoming';
  const allowsAutoplay = isIncoming || kind === 'call' || kind === 'battle';
  const win = new BrowserWindow({
    width: isIncoming ? 440 : kind === 'main' ? 1380 : 1100,
    height: isIncoming ? 580 : 850,
    minWidth: isIncoming ? 440 : 900,
    minHeight: isIncoming ? 580 : 650,
    resizable: !isIncoming,
    maximizable: !isIncoming,
    alwaysOnTop: isIncoming,
    backgroundColor: '#1a1a1e',
    title: 'ChisikiRoom',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: allowsAutoplay
        ? 'no-user-gesture-required'
        : 'document-user-activation-required',
    },
  });
  windows.set(key, win);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.on('close', (event) => {
    if (kind === 'call' && activeCall === id) {
      activeCall = undefined;
      fetch(apiUrl + `/api/calls/${id}/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
    }
    if (kind === 'battle') {
      event.preventDefault();
      if (
        dialog.showMessageBoxSync(win, {
          type: 'question',
          buttons: ['Ở lại', 'Rời trận'],
          defaultId: 0,
          cancelId: 0,
          message: 'Đóng cửa sổ sẽ rời trận. Bạn muốn tiếp tục?',
        }) === 1
      ) {
        fetch(apiUrl + `/api/battles/${id}/leave`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5000),
        })
          .catch(() => {})
          .finally(() => win.destroy());
      }
      return;
    }
    if (
      dirtyWindows.has(win.id) &&
      dialog.showMessageBoxSync(win, {
        type: 'question',
        buttons: ['Tiếp tục chỉnh sửa', 'Bỏ thay đổi'],
        defaultId: 0,
        cancelId: 0,
        message:
          kind === 'quiz'
            ? 'Bộ câu hỏi chưa được lưu. Bạn muốn đóng cửa sổ?'
            : 'Bản nháp chưa lưu lên máy chủ. Bạn muốn đóng cửa sổ và bỏ thay đổi?',
      }) === 0
    ) {
      event.preventDefault();
    }
  });
  win.on('closed', () => {
    windows.delete(key);
    dirtyWindows.delete(win.id);
    if (kind === 'call' || kind === 'battle') {
      incomingCalls.resume();
    }
  });
  const hash = kind === 'main' ? '' : `${kind}/${id || 'new'}`;
  if (process.env.CHISIKI_DEV === '1') {
    win.loadURL('http://127.0.0.1:5173/#' + hash);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'), { hash });
  }
  return win;
}
app.whenReady().then(async () => {
  if (!process.env.CHISIKI_API_URL) {
    try {
      const saved = JSON.parse(
        await fs.readFile(path.join(app.getPath('userData'), 'server.json'), 'utf8'),
      );
      if (typeof saved.apiUrl === 'string') {
        apiUrl = saved.apiUrl;
      }
    } catch {}
  }
  const parsed = new URL(apiUrl);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('CHISIKI_API_URL không hợp lệ');
  }
  apiUrl = parsed.origin;
  const canUseMedia = (wc) =>
    Boolean(token) &&
    [...windows.entries()].some(
      ([key, win]) =>
        (key.startsWith('battle:') || key === `call:${activeCall}`) && win.webContents === wc,
    );
  require('electron').session.defaultSession.setPermissionRequestHandler(
    (wc, permission, callback) => callback(permission === 'media' && canUseMedia(wc)),
  );
  require('electron').session.defaultSession.setPermissionCheckHandler(
    (wc, permission) => permission === 'media' && canUseMedia(wc),
  );
  openWindow();
});
app.on('before-quit', () => {
  if (realtime) {
    void realtime.deactivate();
  }
});
app.on('window-all-closed', () => app.quit());
