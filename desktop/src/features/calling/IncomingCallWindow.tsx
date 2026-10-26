import { useEffect, useState } from 'react';
import { Alert, Button } from 'antd';
import {
  PhoneOutlined,
  VideoCameraOutlined,
  SoundOutlined,
  MutedOutlined,
} from '@ant-design/icons';
import { request, errorMessage, type RoomCall, type Room } from '../../lib/api';
import { UserAvatar } from '../../components/UserAvatar';
import { useRingtone } from './useRingtone';
import './calling.css';

export function IncomingCallWindow({ id }: { id: string }) {
  const [call, setCall] = useState<RoomCall | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState(true);
  useRingtone(sound && !busy && call?.status === 'ACTIVE');

  useEffect(() => {
    let mounted = true;
    const dismiss = () => window.chisiki?.respondIncoming(id, 'dismiss');
    async function refresh() {
      try {
        const snapshot = await request<RoomCall>('call', { id });
        if (!mounted) {
          return;
        }
        setCall(snapshot);
        if (snapshot.status !== 'ACTIVE') {
          setSound(false);
          void dismiss();
        }
      } catch (failure) {
        if (mounted) {
          setSound(false);
          setError(errorMessage(failure));
        }
      }
    }
    void refresh();
    request<Room[]>('rooms')
      .then((rooms) => {
        if (mounted) {
          request<RoomCall>('call', { id })
            .then((snapshot) => {
              if (mounted) {
                setRoom(rooms.find((candidate) => candidate.id === snapshot.roomId) || null);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
    const timer = setInterval(refresh, 2500);
    const timeout = setTimeout(() => {
      setSound(false);
      void window.chisiki?.respondIncoming(id, 'decline');
    }, 45000);
    const unsubscribe = window.chisiki?.onEvent((event) => {
      if (event.data?.callId === id && event.type !== 'CALL_SIGNAL') {
        void refresh();
      }
    });
    return () => {
      mounted = false;
      clearInterval(timer);
      clearTimeout(timeout);
      unsubscribe?.();
    };
  }, [id]);

  async function respond(accept: boolean) {
    setBusy(true);
    setError('');
    try {
      const result = await window.chisiki?.respondIncoming(id, accept ? 'accept' : 'decline');
      if (result?.error) {
        throw new Error(result.error);
      }
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  }

  const caller = call?.participants.find((participant) => participant.id === call.callerId);
  return (
    <div className="incoming-call-window" role="dialog" aria-labelledby="incoming-call-title">
      <span className="eyebrow">CHISIKIROOM · KẾT NỐI</span>
      <div className="incoming-avatar">
        <UserAvatar id={caller?.id || ''} name={caller?.displayName || '?'} />
      </div>
      <h1>{caller?.displayName || 'Đang kết nối…'}</h1>
      <h2 id="incoming-call-title">Cuộc gọi đến</h2>
      <p>{room?.kind === 'GROUP' ? `Gọi nhóm · ${room.name}` : 'Muốn trò chuyện cùng bạn'}</p>
      <div className="incoming-privacy">
        <VideoCameraOutlined /> Camera và mic chỉ bật khi bạn chọn.
      </div>
      {error && <Alert type="error" message={error} />}
      <div className="incoming-actions">
        <Button danger size="large" disabled={busy} onClick={() => respond(false)}>
          Từ chối
        </Button>
        <Button
          type="primary"
          size="large"
          icon={<PhoneOutlined />}
          loading={busy}
          disabled={!call}
          onClick={() => respond(true)}
        >
          Nhận cuộc gọi
        </Button>
      </div>
      <Button
        type="text"
        icon={sound ? <SoundOutlined /> : <MutedOutlined />}
        aria-label={sound ? 'Tắt chuông' : 'Bật chuông'}
        onClick={() => setSound(!sound)}
      >
        {sound ? 'Tắt chuông' : 'Bật chuông'}
      </Button>
    </div>
  );
}
