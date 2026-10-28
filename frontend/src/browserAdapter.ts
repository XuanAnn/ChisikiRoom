import { Client } from '@stomp/stompjs';
import { route } from '../../desktop/electron/api-routes.mjs';
import type { ServerEvent } from '../../desktop/src/lib/api';

type Tool = { kind: string; id: string };
type Result = { data?: any; error?: string };

export function installBrowserAdapter() {
  const configuredUrl = import.meta.env.VITE_API_URL || window.location.origin;
  let apiUrl = localStorage.getItem('chisiki-server') || configuredUrl;
  let token: string | undefined;
  let sessionVersion = 0;
  let realtime: Client | undefined;
  let connection = 'offline';
  let activeTool: Tool | null = null;
  let incomingCall: string | null = null;
  let openingTool = false;
  const dismissedCalls = new Set<string>();
  const dirtyScopes = new Set<string>();
  const listeners = new Set<(event: ServerEvent) => void>();

  function emit(event: ServerEvent) {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Không xử lý được sự kiện ứng dụng:', error);
      }
    }
  }

  function disconnect() {
    const previous = realtime;
    realtime = undefined;
    void previous?.deactivate();
    connection = 'offline';
    emit({ type: 'CONNECTION', data: connection });
  }

  function clearSession() {
    sessionVersion += 1;
    token = undefined;
    activeTool = null;
    incomingCall = null;
    dirtyScopes.clear();
    dismissedCalls.clear();
    disconnect();
    emit({ type: 'WEB_TOOL', data: null });
    emit({ type: 'WEB_INCOMING', data: null });
    emit({ type: 'SIGNED_OUT', data: null });
  }

  function connectRealtime() {
    disconnect();
    const client = new Client({
      brokerURL: apiUrl.replace(/^http/, 'ws') + '/ws',
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 2000,
      connectionTimeout: 10000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        if (realtime !== client) {
          return;
        }
        client.subscribe('/user/queue/events', (message) => {
          if (realtime !== client) {
            return;
          }
          try {
            const event = JSON.parse(message.body) as ServerEvent;
            if (event.type === 'CALL_ENDED' && event.data.callId === incomingCall) {
              incomingCall = null;
              emit({ type: 'WEB_INCOMING', data: null });
            }
            emit(event);
          } catch {
            // Ignore malformed events instead of interrupting the subscription.
          }
        });
        connection = 'online';
        emit({ type: 'CONNECTION', data: connection });
      },
      onWebSocketClose: () => {
        if (realtime === client) {
          connection = 'offline';
          emit({ type: 'CONNECTION', data: connection });
        }
      },
    });
    realtime = client;
    client.activate();
  }

  async function send(endpoint: string, options: RequestInit = {}, timeout = 15000) {
    const headers = new Headers(options.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(apiUrl + endpoint, {
      ...options,
      headers,
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(timeout),
    });
  }

  async function request(action: string, body?: any): Promise<Result> {
    const version = sessionVersion;
    try {
      const [method, endpoint] = route(action, body);
      const { id, messageId, ...payload } = body || {};
      const response = await send(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method !== 'GET' && body ? JSON.stringify(payload) : undefined,
      });
      const text = await response.text();
      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          return { error: 'Máy chủ trả về dữ liệu không hợp lệ. Kiểm tra API và reverse proxy.' };
        }
      }
      if (version !== sessionVersion) {
        return { error: 'Phiên đăng nhập đã thay đổi. Vui lòng thử lại.' };
      }
      if (!response.ok) {
        if (response.status === 401 && token && !['login', 'register'].includes(action)) {
          const expired = action === 'me' || (await send('/api/auth/me')).status === 401;
          if (expired && version === sessionVersion) {
            clearSession();
            return { error: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.' };
          }
        }
        return { error: data?.message || `Yêu cầu thất bại (${response.status})` };
      }
      if (action === 'login' || action === 'register') {
        if (!data?.token || !data.user) {
          return { error: 'Máy chủ không trả về phiên đăng nhập hợp lệ.' };
        }
        sessionVersion += 1;
        token = data.token;
        delete data.token;
        connectRealtime();
      }
      if (action === 'logout') {
        clearSession();
      }
      return { data };
    } catch {
      return { error: 'Không kết nối được máy chủ. Kiểm tra mạng, HTTPS và cấu hình API.' };
    }
  }

  async function closeTool(): Promise<{ error?: string }> {
    if (dirtyScopes.has('quiz') && !window.confirm('Bộ câu hỏi chưa lưu. Bạn muốn đóng?')) {
      return { error: 'Đã giữ lại bộ câu hỏi chưa lưu.' };
    }
    if (activeTool?.kind === 'call' || activeTool?.kind === 'battle') {
      const action = activeTool.kind === 'call' ? 'leaveCall' : 'leaveBattle';
      const result = await request(action, { id: activeTool.id });
      if (result.error) {
        return { error: result.error };
      }
    }
    activeTool = null;
    dirtyScopes.delete('quiz');
    emit({ type: 'WEB_TOOL', data: null });
    return {};
  }

  function selectFile(accept: string): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.addEventListener('change', () => resolve(input.files?.[0] || null), { once: true });
      input.addEventListener('cancel', () => resolve(null), { once: true });
      input.click();
    });
  }

  async function upload(
    endpoint: string,
    maxBytes: number,
    accept: string,
    roomId?: string,
  ): Promise<Result> {
    const version = sessionVersion;
    try {
      if (!token) {
        return { error: 'Hãy đăng nhập trước khi tải file.' };
      }
      const file = await selectFile(accept);
      if (!file) {
        return { data: null };
      }
      if (version !== sessionVersion || !token) {
        return { error: 'Phiên đăng nhập đã thay đổi. Hãy chọn lại file.' };
      }
      if (file.size > maxBytes) {
        return { error: `File tối đa ${maxBytes / 1024 / 1024} MB.` };
      }
      const form = new FormData();
      form.set('file', file);
      if (roomId) {
        form.set('roomId', roomId);
      }
      const response = await send(endpoint, { method: 'POST', body: form }, 60000);
      const data = await response.json();
      return response.ok ? { data } : { error: data.message || 'Không tải được file.' };
    } catch {
      return { error: 'Không tải được file. Kiểm tra kết nối máy chủ.' };
    }
  }

  function normalizeUrl(value: string) {
    const parsed = new URL(value.trim());
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error('Nhập địa chỉ gốc HTTP/HTTPS, không kèm đường dẫn hoặc thông tin đăng nhập.');
    }
    if (location.protocol === 'https:' && parsed.protocol !== 'https:') {
      throw new Error('Trang HTTPS cần kết nối backend HTTPS.');
    }
    return parsed.origin;
  }

  try {
    apiUrl = normalizeUrl(apiUrl);
  } catch {
    apiUrl = normalizeUrl(configuredUrl);
  }

  window.chisiki = {
    platform: 'web',
    request,
    connection: async () => connection,
    onEvent: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    closeTool,
    openWindow: async (kind, id) => {
      const version = sessionVersion;
      if (!token || !['quiz', 'practice', 'battle', 'call'].includes(kind)) {
        throw new Error('Hãy đăng nhập để mở chức năng này.');
      }
      if (activeTool?.kind === kind && activeTool.id === id) {
        return;
      }
      if (openingTool) {
        throw new Error('Đang mở chức năng. Vui lòng chờ.');
      }
      openingTool = true;
      try {
        const closed = await closeTool();
        if (closed.error) {
          throw new Error(closed.error);
        }
        let toolId = id || 'new';
        if (kind === 'call') {
          const response = await send(`/api/chat-rooms/${id}/call`, { method: 'POST' });
          const call = await response.json();
          if (!response.ok) {
            throw new Error(call.message || 'Không mở được cuộc gọi.');
          }
          toolId = call.id;
        }
        if (version !== sessionVersion || !token) {
          throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng thử lại.');
        }
        activeTool = { kind, id: toolId };
        emit({ type: 'WEB_TOOL', data: activeTool });
      } finally {
        openingTool = false;
      }
    },
    notifyIncoming: async (callId) => {
      if (
        incomingCall ||
        dismissedCalls.has(callId) ||
        ['call', 'battle'].includes(activeTool?.kind || '')
      ) {
        return;
      }
      incomingCall = callId;
      emit({ type: 'WEB_INCOMING', data: callId });
    },
    respondIncoming: async (callId, decision) => {
      if (decision === 'accept') {
        const closed = await closeTool();
        if (closed.error) {
          return closed;
        }
        const result = await request('joinCall', { id: callId });
        if (result.error) {
          return result;
        }
        activeTool = { kind: 'call', id: callId };
        emit({ type: 'WEB_TOOL', data: activeTool });
      } else if (decision === 'decline') {
        const result = await request('declineCall', { id: callId });
        if (result.error) {
          return result;
        }
      }
      dismissedCalls.add(callId);
      incomingCall = null;
      emit({ type: 'WEB_INCOMING', data: null });
      return { data: true };
    },
    avatar: async (userId) => {
      try {
        const response = await send(`/api/profile/${userId}/avatar`);
        if (!response.ok) {
          return null;
        }
        const blob = await response.blob();
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    },
    uploadAvatar: () => upload('/api/profile/avatar', 2 * 1024 * 1024, 'image/png,image/jpeg'),
    uploadDocument: (roomId) =>
      upload('/api/documents', 20 * 1024 * 1024, '.pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg', roomId),
    downloadDocument: async (id, filename) => {
      try {
        const response = await send(`/api/documents/${id}/download`, {}, 60000);
        if (!response.ok) {
          return { error: `Không tải được file (${response.status}).` };
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        return { data: true };
      } catch {
        return { error: 'Không tải được file.' };
      }
    },
    serverSettings: async (value) => {
      if (value === undefined) {
        return { data: apiUrl };
      }
      if (token) {
        return { error: 'Hãy đăng xuất trước khi đổi máy chủ.' };
      }
      try {
        const normalized = normalizeUrl(value);
        localStorage.setItem('chisiki-server', normalized);
        apiUrl = normalized;
        return { data: apiUrl };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Không lưu được máy chủ.' };
      }
    },
    checkServer: async (value) => {
      try {
        const url = normalizeUrl(value);
        const started = performance.now();
        const response = await fetch(url + '/actuator/health', {
          credentials: 'omit',
          redirect: 'error',
          signal: AbortSignal.timeout(8000),
        });
        const health = await response.json();
        if (!response.ok || health.status !== 'UP') {
          return { error: 'Backend chưa sẵn sàng.' };
        }
        return { data: { url, latencyMs: Math.round(performance.now() - started) } };
      } catch {
        return {
          error:
            'Không kiểm tra được backend. Kiểm tra URL, HTTPS và chính sách CORS nếu khác tên miền.',
        };
      }
    },
    setDirty: (dirty, scope = 'default') => {
      if (dirty) {
        dirtyScopes.add(scope);
      } else {
        dirtyScopes.delete(scope);
      }
    },
  };

  window.addEventListener('beforeunload', (event) => {
    if (dirtyScopes.size || activeTool?.kind === 'call' || activeTool?.kind === 'battle') {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  window.addEventListener('pagehide', () => {
    if (token && (activeTool?.kind === 'call' || activeTool?.kind === 'battle')) {
      const kind = activeTool.kind === 'call' ? 'calls' : 'battles';
      void fetch(`${apiUrl}/api/${kind}/${activeTool.id}/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true,
        credentials: 'omit',
      }).catch(() => {});
    }
    disconnect();
  });
}
