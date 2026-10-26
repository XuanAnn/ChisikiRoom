import { useEffect, useState } from 'react';
import { Alert, Button } from 'antd';
import { VideoCameraOutlined } from '@ant-design/icons';
import { request, errorMessage, type Room, type RoomCall } from '../../lib/api';

export function CallPanel({ room }: { room: Room }) {
  const [call, setCall] = useState<RoomCall | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () =>
      request<RoomCall | null>('roomCall', { id: room.id })
        .then((next) => {
          if (active) {
            setCall(next);
          }
        })
        .catch((e) => {
          if (active) {
            setError(errorMessage(e));
          }
        });
    void load();
    const timer = setInterval(load, 5000);
    const unsub = window.chisiki?.onEvent((event) => {
      if (event.data?.roomId === room.id && event.type.startsWith('CALL_')) {
        void load();
      }
    });
    return () => {
      active = false;
      clearInterval(timer);
      unsub?.();
    };
  }, [room.id]);
  async function open() {
    setBusy(true);
    setError('');
    try {
      await window.chisiki?.openWindow('call', room.id);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button icon={<VideoCameraOutlined />} loading={busy} onClick={open}>
        {call ? 'Tham gia cuộc gọi' : 'Gọi video'}
      </Button>
      {error && <Alert type="error" message={error} closable onClose={() => setError('')} />}
    </>
  );
}

export function IncomingCalls({ rooms, userId }: { rooms: Room[]; userId: string }) {
  const roomIds = rooms
    .filter((room) => room.joined)
    .map((room) => room.id)
    .join(',');
  useEffect(() => {
    let mounted = true;
    async function refresh() {
      const snapshots = await Promise.allSettled(
        roomIds ? roomIds.split(',').map((id) => request<RoomCall | null>('roomCall', { id })) : [],
      );
      if (!mounted) {
        return;
      }
      for (const snapshot of snapshots) {
        if (snapshot.status !== 'fulfilled' || !snapshot.value) {
          continue;
        }
        const call = snapshot.value;
        if (call.callerId !== userId && !call.participants.some((person) => person.id === userId)) {
          void window.chisiki?.notifyIncoming(call.id);
        }
      }
    }
    void refresh();
    const timer = setInterval(refresh, 10000);
    const unsubscribe = window.chisiki?.onEvent((event) => {
      if (event.type.startsWith('CALL_') || event.type === 'CONNECTION') {
        void refresh();
      }
    });
    return () => {
      mounted = false;
      clearInterval(timer);
      unsubscribe?.();
    };
  }, [roomIds, userId]);
  return null;
}
