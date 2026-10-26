import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Space, Tag } from 'antd';
import {
  AudioMutedOutlined,
  AudioOutlined,
  PhoneOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { request, errorMessage, type User, type RoomCall, type Room } from '../../lib/api';
import { usePeerMedia } from '../../hooks/usePeerMedia';
import { Video } from '../../components/Video';
import './calling.css';

export function CallWindow({ id }: { id: string }) {
  const [call, setCall] = useState<RoomCall | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(false);
  const camera = useRef(false);
  const revokedRooms = useRef(new Set<string>());
  const callRoom = useRef('');
  const mounted = useRef(true);
  const stopped = useRef(false);
  const media = usePeerMedia(
    id,
    left ? '' : user?.id || '',
    call?.participants.map((p) => ({ ...p, status: 'ACTIVE' })) || [],
    'call',
  );
  camera.current = media.camera;
  function accept(next: RoomCall) {
    callRoom.current = next.roomId;
    if (revokedRooms.current.has(next.roomId)) {
      stopped.current = true;
      setLeft(true);
      setError('Bạn không còn là thành viên nhóm. Cuộc gọi đã dừng.');
      return;
    }
    if (!mounted.current || stopped.current) {
      return;
    }
    setCall((prev) => (prev && prev.sequence > next.sequence ? prev : next));
    if (next.status === 'ENDED') {
      stopped.current = true;
      setLeft(true);
    }
  }
  useEffect(() => {
    mounted.current = true;
    let pending = false;
    // Joining records explicit consent before media permissions are available.
    Promise.all([request<User>('me'), request<RoomCall>('joinCall', { id })])
      .then(([me, next]) => {
        if (mounted.current) {
          accept(next);
          setUser(me);
          request<Room[]>('rooms')
            .then((rooms) => {
              const nextRoom = rooms.find((candidate) => candidate.id === next.roomId) || null;
              if (mounted.current) {
                setRoom(nextRoom);
              }
            })
            .catch((error) => {
              if (mounted.current) {
                setError(errorMessage(error));
              }
            });
        }
      })
      .catch((e) => {
        if (mounted.current) {
          stopped.current = true;
          setError(errorMessage(e));
          setLeft(true);
        }
      });
    const sync = async () => {
      if (pending || stopped.current) {
        return;
      }
      pending = true;
      try {
        accept(await request<RoomCall>('callHeartbeat', { id, camera: camera.current }));
      } catch (e) {
        if (mounted.current) {
          setError(errorMessage(e));
        }
      } finally {
        pending = false;
      }
    };
    const timer = setInterval(() => void sync(), 2500);
    const unsub = window.chisiki?.onEvent((event) => {
      if (event.type === 'ROOM_MEMBERSHIP_REVOKED') {
        revokedRooms.current.add(event.data.roomId);
        if (callRoom.current === event.data.roomId) {
          stopped.current = true;
          setLeft(true);
          setError('Bạn không còn là thành viên nhóm. Cuộc gọi đã dừng.');
        }
      }
      if (
        event.data?.callId === id &&
        (event.type === 'CALL_CHANGED' || event.type === 'CALL_ENDED')
      ) {
        request<RoomCall>('call', { id })
          .then(accept)
          .catch((e) => setError(errorMessage(e)));
      }
      if (event.type === 'CONNECTION' && event.data === 'online') {
        void sync();
      }
    });
    return () => {
      mounted.current = false;
      clearInterval(timer);
      unsub?.();
    };
  }, [id]);
  useEffect(() => {
    if (user && !left) {
      request<RoomCall>('callHeartbeat', { id, camera: media.camera })
        .then(accept)
        .catch((e) => setError(errorMessage(e)));
    }
  }, [media.camera, user?.id, left]);
  async function leave() {
    setBusy(true);
    try {
      await request('leaveCall', { id });
      stopped.current = true;
      setLeft(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const participants = call?.participants || [];
  const remoteParticipants = participants.filter((participant) => participant.id !== user?.id);
  const isGroupCall = room?.kind === 'GROUP' || participants.length > 2;
  const remoteColumns = Math.max(1, Math.ceil(Math.sqrt(remoteParticipants.length)));
  const layoutClass = isGroupCall ? 'call-group' : 'call-direct';
  return (
    <div className="call-window">
      <header>
        <div>
          <span className="eyebrow">CHISIKIROOM · CUỘC GỌI</span>
          <h2>{left ? 'Cuộc gọi đã kết thúc' : 'Trò chuyện cùng nhau'}</h2>
        </div>
        <Tag>{call?.participants.length || 0}/4 người</Tag>
      </header>
      {error && <Alert type="error" message={error} closable onClose={() => setError('')} />}
      {!left && media.mediaError && <Alert type="warning" message={media.mediaError} />}
      {left ? (
        <div className="empty-center">
          <h2>Hẹn gặp lại!</h2>
          <p>Bạn có thể đóng cửa sổ này và tiếp tục chat.</p>
        </div>
      ) : (
        <>
          <div
            className={`video-grid call-grid ${layoutClass}`}
            style={{ gridTemplateColumns: `repeat(${remoteColumns}, minmax(0, 1fr))` }}
            aria-label={isGroupCall ? 'Lưới video nhóm' : 'Video cuộc gọi riêng'}
          >
            {remoteParticipants.length === 0 && (
              <div className="call-waiting">Đang chờ người được mời tham gia…</div>
            )}
            {call?.participants.map((p) => (
              <div
                className={
                  p.id === user?.id ? 'video-tile self-preview' : 'video-tile remote-video'
                }
                key={p.id}
                data-participant-id={p.id}
              >
                <Video
                  stream={p.id === user?.id ? media.local : media.remote[p.id]}
                  muted={p.id === user?.id}
                />
                {!(p.id === user?.id ? media.camera : p.camera) && (
                  <div className="camera-off">{p.displayName.slice(0, 1).toUpperCase()}</div>
                )}
                <div className="video-caption">
                  {p.displayName}
                  {p.id === user?.id ? ' (bạn)' : ''}
                </div>
              </div>
            ))}
          </div>
          {call?.participants.length === 1 && (
            <p className="muted">Đang chờ người được mời tham gia…</p>
          )}
          <Space wrap className="call-controls">
            <Button
              aria-label={media.camera ? 'Tắt camera' : 'Bật camera'}
              icon={<VideoCameraOutlined />}
              disabled={!media.online || !user}
              onClick={() => (media.camera ? media.disableCamera() : media.enableCamera())}
            >
              {media.camera ? 'Tắt camera' : 'Bật camera'}
            </Button>
            <Button
              aria-label={media.mic ? 'Tắt mic' : 'Bật mic'}
              icon={media.mic ? <AudioOutlined /> : <AudioMutedOutlined />}
              disabled={!media.online || !user}
              onClick={media.toggleMic}
            >
              {media.mic ? 'Tắt mic' : 'Bật mic'}
            </Button>
            <Button
              aria-label="Rời cuộc gọi"
              danger
              type="primary"
              icon={<PhoneOutlined />}
              loading={busy}
              onClick={leave}
            >
              Rời cuộc gọi
            </Button>
          </Space>
          <p className="muted">
            Camera và mic tùy chọn · Không ghi hình/âm thanh · P2P trong mạng LAN
          </p>
        </>
      )}
    </div>
  );
}
