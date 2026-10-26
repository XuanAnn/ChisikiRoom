import { useEffect, useRef, useState } from 'react';
import { request, errorMessage, type ChatState } from '../../lib/api';

export type WorkspaceTab = 'home' | 'chat' | 'quiz' | 'ranking';

export function useWorkspaceActivity(
  userId: string,
  roomId: string,
  tab: WorkspaceTab,
  latestMessageId = 0,
) {
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<Record<string, ChatState>>({});
  const [status, setStatus] = useState('');
  const view = useRef({ roomId, tab, latestMessageId });
  view.current = { roomId, tab, latestMessageId };
  const values = useRef<Record<string, string>>({});
  const versions = useRef<Record<string, number>>({});
  const dirty = useRef(new Set<string>());
  const saving = useRef(new Set<string>());
  const inFlight = useRef(new Map<string, Promise<void>>());
  const conflicting = useRef<Record<string, ChatState>>({});
  const timers = useRef(new Map<string, number>());
  const marked = useRef<Record<string, number>>({});
  const received = useRef(new Set<number>());
  const ready = useRef(false);
  const refreshGeneration = useRef(0);
  const mounted = useRef(true);

  function updateDirtyFlag() {
    window.chisiki?.setDirty(dirty.current.size > 0);
  }
  function schedule(id: string, delay = 600) {
    window.clearTimeout(timers.current.get(id));
    timers.current.set(
      id,
      window.setTimeout(() => {
        timers.current.delete(id);
        void persist(id);
      }, delay),
    );
  }
  function persist(id: string): Promise<void> {
    const existing = inFlight.current.get(id);
    if (existing) {
      return existing;
    }
    const operation = save(id).finally(() => {
      inFlight.current.delete(id);
    });
    inFlight.current.set(id, operation);
    return operation;
  }
  async function save(id: string) {
    if (
      !mounted.current ||
      !ready.current ||
      saving.current.has(id) ||
      !dirty.current.has(id) ||
      conflicting.current[id]
    ) {
      return;
    }
    const content = values.current[id] || '';
    saving.current.add(id);
    setStatus('Đang lưu bản nháp…');
    try {
      const next = await request<ChatState>('saveDraft', {
        id,
        content,
        version: versions.current[id] || 0,
      });
      if (!mounted.current) {
        return;
      }
      versions.current[id] = next.draftVersion;
      if (values.current[id] === content) {
        dirty.current.delete(id);
      }
      setStatus('Đã lưu bản nháp');
    } catch (exception) {
      if (!mounted.current) {
        return;
      }
      const message = errorMessage(exception);
      setStatus(message);
      if (message.includes('DRAFT_CONFLICT')) {
        try {
          const rows = await request<ChatState[]>('chatStates');
          const server = rows.find((row) => row.roomId === id);
          if (server && mounted.current) {
            conflicting.current[id] = server;
            setConflicts({ ...conflicting.current });
          }
        } catch {
          /* Keep local text and retry after reconnect. */
        }
      }
    } finally {
      saving.current.delete(id);
      if (mounted.current) {
        updateDirtyFlag();
      }
      if (
        mounted.current &&
        dirty.current.has(id) &&
        values.current[id] !== content &&
        !conflicting.current[id]
      ) {
        schedule(id, 0);
      }
    }
  }
  async function refresh() {
    const generation = ++refreshGeneration.current;
    try {
      const rows = await request<ChatState[]>('chatStates');
      if (!mounted.current || generation !== refreshGeneration.current) {
        return;
      }
      const counts: Record<string, number> = {};
      for (const row of rows) {
        if (
          !dirty.current.has(row.roomId) &&
          row.draftVersion >= (versions.current[row.roomId] || 0)
        ) {
          values.current[row.roomId] = row.draft;
          versions.current[row.roomId] = row.draftVersion;
        } else if (versions.current[row.roomId] === undefined) {
          versions.current[row.roomId] = row.draftVersion;
        }
        marked.current[row.roomId] = Math.max(marked.current[row.roomId] || 0, row.lastReadId);
        counts[row.roomId] = row.unreadCount;
        if (
          view.current.tab === 'chat' &&
          view.current.roomId === row.roomId &&
          document.hasFocus()
        ) {
          counts[row.roomId] = 0;
        }
      }
      ready.current = true;
      setDrafts({ ...values.current });
      setUnread(counts);
      for (const id of dirty.current) {
        schedule(id, 0);
      }
      void markRead(view.current.roomId, view.current.latestMessageId);
    } catch (exception) {
      if (mounted.current) {
        setStatus(errorMessage(exception));
      }
    }
  }
  async function markRead(id: string, messageId: number) {
    if (
      !id ||
      messageId <= 0 ||
      view.current.tab !== 'chat' ||
      view.current.roomId !== id ||
      !document.hasFocus()
    ) {
      return;
    }
    setUnread((previous) => ({ ...previous, [id]: 0 }));
    if (messageId <= (marked.current[id] || 0)) {
      return;
    }
    marked.current[id] = messageId;
    try {
      await request('markRead', { id, lastReadId: messageId });
    } catch {
      marked.current[id] = 0;
    }
  }
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    function onFocus() {
      void refresh();
      void markRead(view.current.roomId, view.current.latestMessageId);
    }
    function onBlur() {
      for (const id of dirty.current) {
        void persist(id);
      }
    }
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    const unsubscribe = window.chisiki?.onEvent((event) => {
      if (['CONNECTION', 'ROOM_CHANGED', 'MESSAGE_CHANGED'].includes(event.type)) {
        void refresh();
      }
      if (
        event.type !== 'MESSAGE_CREATED' ||
        event.data.senderId === userId ||
        received.current.has(event.data.id)
      ) {
        return;
      }
      received.current.add(event.data.id);
      if (received.current.size > 2000) {
        received.current.delete(received.current.values().next().value!);
      }
      const reading =
        document.hasFocus() &&
        view.current.tab === 'chat' &&
        view.current.roomId === event.data.roomId;
      if (reading) {
        void markRead(event.data.roomId, event.data.id);
      } else {
        setUnread((previous) => ({
          ...previous,
          [event.data.roomId]: (previous[event.data.roomId] || 0) + 1,
        }));
      }
    });
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      for (const timeout of timers.current.values()) {
        window.clearTimeout(timeout);
      }
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      unsubscribe?.();
      window.chisiki?.setDirty(false);
    };
  }, [userId]);
  useEffect(() => {
    void markRead(roomId, latestMessageId);
  }, [roomId, tab, latestMessageId]);

  function setDraft(id: string, content: string) {
    values.current[id] = content;
    dirty.current.add(id);
    setDrafts({ ...values.current });
    setStatus('Bản nháp đang chờ lưu…');
    updateDirtyFlag();
    schedule(id);
  }
  function clearSentDraft(id: string, sentText: string) {
    if (values.current[id] === sentText) {
      setDraft(id, '');
      schedule(id, 0);
    }
  }
  function resolveDraft(useLocal: boolean) {
    const conflict = conflicting.current[roomId];
    if (!conflict) {
      return;
    }
    versions.current[roomId] = conflict.draftVersion;
    delete conflicting.current[roomId];
    setConflicts({ ...conflicting.current });
    if (useLocal) {
      schedule(roomId, 0);
    } else {
      values.current[roomId] = conflict.draft;
      dirty.current.delete(roomId);
      setDrafts({ ...values.current });
      setStatus('Đã dùng bản nháp trên máy chủ');
      updateDirtyFlag();
    }
  }
  async function flushDrafts() {
    for (let attempt = 0; attempt < 2; attempt++) {
      await Promise.all([...inFlight.current.values()]);
      await Promise.all([...dirty.current].map(persist));
    }
    return dirty.current.size === 0;
  }
  return {
    flushDrafts,
    unread,
    drafts,
    setDraft,
    clearSentDraft,
    status,
    conflict: conflicts[roomId],
    resolveDraft,
  };
}
