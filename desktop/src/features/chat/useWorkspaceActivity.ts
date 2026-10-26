import { useEffect, useRef, useState } from 'react';

export type WorkspaceTab = 'home' | 'chat' | 'quiz';

/** Session-local unread counters and drafts. Message content is not stored on disk. */
export function useWorkspaceActivity(userId: string, roomId: string, tab: WorkspaceTab) {
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const currentView = useRef({ roomId, tab });
  const received = useRef(new Set<number>());
  currentView.current = { roomId, tab };

  function markRead(id: string) {
    setUnread((previous) => {
      if (!previous[id]) {
        return previous;
      }
      return { ...previous, [id]: 0 };
    });
  }

  useEffect(() => {
    function onFocus() {
      if (currentView.current.tab === 'chat') {
        markRead(currentView.current.roomId);
      }
    }
    window.addEventListener('focus', onFocus);
    const unsubscribe = window.chisiki?.onEvent((event) => {
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
        currentView.current.tab === 'chat' &&
        currentView.current.roomId === event.data.roomId;
      if (!reading) {
        setUnread((previous) => ({
          ...previous,
          [event.data.roomId]: (previous[event.data.roomId] || 0) + 1,
        }));
      }
    });
    return () => {
      window.removeEventListener('focus', onFocus);
      unsubscribe?.();
    };
  }, [userId]);

  useEffect(() => {
    if (tab === 'chat' && document.hasFocus()) {
      markRead(roomId);
    }
  }, [roomId, tab]);

  function setDraft(id: string, content: string) {
    setDrafts((previous) => ({ ...previous, [id]: content }));
  }

  function clearSentDraft(id: string, sentText: string) {
    setDrafts((previous) => (previous[id] === sentText ? { ...previous, [id]: '' } : previous));
  }

  return { unread, drafts, setDraft, clearSentDraft };
}
