/** Native incoming-call windows. Server snapshots authorize every notification and response. */
function createIncomingCalls({ getSession, canAccept, reserve, createWindow, onAccepted }) {
  const dismissed = new Set();
  const pending = new Map();
  let current;
  let draining = false;
  let responding = false;

  async function api(callId, suffix = '', method = 'GET', session = getSession()) {
    if (!session.token) {
      throw new Error('Hãy đăng nhập lại.');
    }
    const response = await fetch(`${session.apiUrl}/api/calls/${callId}${suffix}`, {
      method,
      headers: { Authorization: `Bearer ${session.token}` },
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {}
    if (!response.ok) {
      throw new Error(data?.message || 'Cuộc gọi không còn khả dụng.');
    }
    return data;
  }

  function close(callId) {
    dismissed.add(callId);
    pending.delete(callId);
    if (current?.callId === callId) {
      const window = current.window;
      current = undefined;
      if (!window.isDestroyed()) {
        window.destroy();
      }
    }
    void drain();
  }

  async function drain() {
    if (draining || current || !canAccept()) {
      return;
    }
    draining = true;
    try {
      for (const [callId, receivedAt] of pending) {
        pending.delete(callId);
        if (dismissed.has(callId) || Date.now() - receivedAt > 45000) {
          continue;
        }
        const session = getSession();
        try {
          const call = await api(callId, '', 'GET', session);
          const sessionUnchanged = session.token === getSession().token;
          const alreadyJoined = call.participants.some((person) => person.id === session.user?.id);
          if (
            !sessionUnchanged ||
            !canAccept() ||
            call.status !== 'ACTIVE' ||
            alreadyJoined ||
            call.callerId === session.user?.id
          ) {
            continue;
          }
          const window = createWindow(callId);
          current = { callId, window };
          window.on('close', () => {
            dismissed.add(callId);
            void api(callId, '/decline', 'POST', session).catch(() => {});
          });
          window.on('closed', () => {
            if (current?.callId === callId) {
              current = undefined;
            }
            void drain();
          });
          break;
        } catch {
          // Ended invitations and temporary failures must not create empty popups.
        }
      }
    } finally {
      draining = false;
    }
  }

  return {
    notify(callId) {
      if (!dismissed.has(callId) && current?.callId !== callId && !pending.has(callId)) {
        pending.set(callId, Date.now());
      }
      void drain();
    },
    observe(event) {
      if (event.type === 'CALL_INVITED') {
        this.notify(event.data.callId);
      }
      if (event.type === 'CALL_ENDED') {
        close(event.data.callId);
      }
      if (event.type === 'CALL_CHANGED' && current?.callId === event.data.callId && !responding) {
        const session = getSession();
        void api(event.data.callId, '', 'GET', session)
          .then((call) => {
            if (
              !responding &&
              session.token === getSession().token &&
              call.participants.some((person) => person.id === session.user?.id)
            ) {
              close(call.id);
            }
          })
          .catch(() => {});
      }
    },
    reset() {
      pending.clear();
      dismissed.clear();
      const window = current?.window;
      current = undefined;
      if (window && !window.isDestroyed()) {
        window.destroy();
      }
    },
    resume() {
      void drain();
    },
    async respond(sender, callId, decision) {
      if (
        !current ||
        current.callId !== callId ||
        current.window.webContents !== sender ||
        responding
      ) {
        return { error: 'Hộp thoại không còn khả dụng.' };
      }
      const session = getSession();
      const window = current.window;
      if (decision === 'dismiss') {
        close(callId);
        return { data: true };
      }
      if (!['accept', 'decline'].includes(decision)) {
        return { error: 'Thao tác không hợp lệ.' };
      }
      if (decision === 'accept' && !canAccept()) {
        return { error: 'Hãy rời cuộc gọi hoặc đóng Battle trước khi nhận cuộc gọi mới.' };
      }
      responding = true;
      const release = decision === 'accept' ? reserve() : () => {};
      try {
        await api(callId, decision === 'accept' ? '/join' : '/decline', 'POST', session);
        if (session.token !== getSession().token || window.isDestroyed()) {
          if (decision === 'accept') {
            void api(callId, '/leave', 'POST', session).catch(() => {});
          }
          return { error: 'Cuộc gọi đã đóng.' };
        }
        if (decision === 'accept') {
          onAccepted(callId);
        }
        close(callId);
        return { data: true };
      } catch (error) {
        return { error: error.message || 'Không xử lý được cuộc gọi.' };
      } finally {
        release();
        responding = false;
        void drain();
      }
    },
  };
}

module.exports = { createIncomingCalls };
