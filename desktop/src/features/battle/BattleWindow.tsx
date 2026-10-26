import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Progress, Space, Tag } from 'antd';
import {
  AudioMutedOutlined,
  AudioOutlined,
  VideoCameraOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { request, errorMessage, type User, type Battle } from '../../lib/api';
import { useBattleMedia } from './useBattleMedia';
import { Video } from '../../components/Video';
export function BattleWindow({ id }: { id: string }) {
  const [battle, setBattle] = useState<Battle | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const offset = useRef(0);
  const state = useRef({ camera: false, ready: false });
  const mounted = useRef(true);
  const media = useBattleMedia(id, user?.id || '', battle?.players || []);
  state.current = { camera: media.camera, ready };
  function accept(snapshot: Battle) {
    if (!mounted.current) {
      return;
    }
    offset.current = Date.parse(snapshot.serverTime) - Date.now();
    setBattle((previous) =>
      previous && previous.sequence > snapshot.sequence ? previous : snapshot,
    );
  }
  useEffect(() => {
    mounted.current = true;
    let inFlight = false;
    request<User>('me')
      .then(setUser)
      .catch((e) => setError(errorMessage(e)));
    request<Battle>('joinBattle', { id })
      .then(accept)
      .catch((e) => setError(errorMessage(e)));
    const heartbeat = async () => {
      if (inFlight) {
        return;
      }
      inFlight = true;
      try {
        accept(await request<Battle>('heartbeat', { id, ...state.current }));
      } catch (e) {
        if (mounted.current) {
          setError(errorMessage(e));
        }
      } finally {
        inFlight = false;
      }
    };
    const timer = setInterval(() => void heartbeat(), 2500);
    const clock = setInterval(() => setNow(Date.now()), 100);
    const unsub = window.chisiki?.onEvent((event) => {
      if (event.data?.battleId === id && event.type !== 'MEDIA_SIGNAL') {
        request<Battle>('battle', { id })
          .then(accept)
          .catch((e) => setError(errorMessage(e)));
      }
      if (event.type === 'CONNECTION' && event.data === 'online') {
        void heartbeat();
      }
    });
    return () => {
      mounted.current = false;
      clearInterval(timer);
      clearInterval(clock);
      unsub?.();
    };
  }, [id]);
  useEffect(() => {
    if (!media.camera) {
      setReady(false);
    }
  }, [media.camera]);
  useEffect(() => {
    if (user) {
      request<Battle>('heartbeat', { id, camera: media.camera, ready })
        .then(accept)
        .catch((e) => setError(errorMessage(e)));
    }
  }, [media.camera, ready, user?.id]);
  async function act(action: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setError('');
    try {
      accept(await request<Battle>(action, { id, ...body }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const round = battle?.round;
  const my = battle?.players.find((p) => p.id === user?.id);
  const active = battle?.players.filter((p) => p.status === 'ACTIVE') || [];
  const remaining = round
    ? Math.max(0, Math.ceil((Date.parse(round.deadlineAt) - now - offset.current) / 1000))
    : 15;
  const finished = battle?.status === 'FINISHED' || battle?.status === 'CANCELLED';
  const sorted = [...(battle?.players || [])].sort((a, b) => b.score - a.score);
  const remotePlayers = active.filter((player) => player.id !== user?.id);
  const topPlayers = remotePlayers.slice(0, 2);
  const sidePlayers = remotePlayers.slice(2);
  const localPlayer = active.find((player) => player.id === user?.id);
  if (localPlayer) {
    sidePlayers.push(localPlayer);
  }
  function renderPlayerVideo(player: Battle['players'][number]) {
    const isLocalPlayer = player.id === user?.id;
    const cameraEnabled = isLocalPlayer ? media.camera : player.camera;
    let cameraLabel = 'Chờ camera';
    if (player.ready) {
      cameraLabel = 'Sẵn sàng';
    } else if (cameraEnabled) {
      cameraLabel = 'Camera bật';
    }
    return (
      <div
        className={isLocalPlayer ? 'video-tile battle-self-preview' : 'video-tile'}
        key={player.id}
        data-participant-id={player.id}
      >
        <Video
          stream={isLocalPlayer ? media.local : media.remote[player.id]}
          muted={isLocalPlayer}
        />
        {!cameraEnabled && <div className="battle-camera-off">{player.displayName[0]}</div>}
        <div className="video-caption">
          <span>
            {player.displayName}
            {isLocalPlayer ? ' (bạn)' : ''}
          </span>
          <Tag color={player.ready ? 'green' : 'default'}>{cameraLabel}</Tag>
        </div>
      </div>
    );
  }
  return (
    <div className="battle-window">
      <header>
        <div>
          <span className="eyebrow">CHISIKIROOM · BATTLE</span>
          <h2>{battle?.title || 'Đang vào trận…'}</h2>
        </div>
        <Space>
          <Tag color={finished ? 'green' : 'purple'}>
            {battle?.status === 'WAITING' ? 'LOBBY' : finished ? 'ĐÃ KẾT THÚC' : 'ĐANG THI ĐẤU'}
          </Tag>
          <Tag>{active.length}/4 người</Tag>
        </Space>
      </header>
      {error && <Alert type="error" message={error} closable onClose={() => setError('')} />}
      {media.mediaError && <Alert type="warning" message={media.mediaError} />}
      <div className="battle-layout">
        <main className="battle-stage">
          <div className="video-grid battle-top-videos" aria-label="Video đối thủ phía trên">
            {topPlayers.map(renderPlayerVideo)}
          </div>
          <div className="media-controls">
            <Button
              icon={<VideoCameraOutlined />}
              disabled={!media.online || !user}
              onClick={media.enableCamera}
            >
              {media.camera ? 'Đổi / mở lại camera' : 'Bật camera'}
            </Button>
            <Button
              disabled={!media.camera}
              icon={media.mic ? <AudioOutlined /> : <AudioMutedOutlined />}
              onClick={media.toggleMic}
            >
              {media.mic ? 'Tắt mic' : 'Bật mic'}
            </Button>
            <small>Chỉ truyền trực tiếp · không ghi hình/âm thanh</small>
          </div>
          {battle?.status === 'WAITING' ? (
            <section className="lobby-panel">
              <ThunderboltOutlined />
              <h1>Sẵn sàng thử sức?</h1>
              <p className="muted">
                Bật camera, đánh dấu sẵn sàng và chờ chủ trận bắt đầu.
                <br />
                15 giây/câu · Đúng đầu tiên +10 · Đối thủ −5 · Một lượt trả lời
              </p>
              <Space>
                <Button
                  type={ready ? 'default' : 'primary'}
                  disabled={!media.camera}
                  onClick={() => setReady(!ready)}
                >
                  {ready ? 'Hủy sẵn sàng' : 'Tôi đã sẵn sàng'}
                </Button>
                {battle.ownerId === user?.id && (
                  <Button
                    type="primary"
                    disabled={active.length < 2 || active.some((p) => !p.ready || !p.camera)}
                    loading={busy}
                    onClick={() => act('startBattle')}
                  >
                    Bắt đầu trận
                  </Button>
                )}
              </Space>
            </section>
          ) : finished ? (
            <section className="results">
              <span className="eyebrow">KẾT QUẢ TRẬN ĐẤU</span>
              <h1>Kiến thức đã lên tiếng.</h1>
              {sorted.map((p, i) => (
                <div className="result-row" key={p.id}>
                  <b>#{sorted.findIndex((s) => s.score === p.score) + 1}</b>
                  <span>
                    {p.displayName}
                    {p.status !== 'ACTIVE'
                      ? ` · ${p.status === 'FORFEITED' ? 'Bỏ cuộc' : 'Đã rời'}`
                      : ''}
                  </span>
                  <strong>{p.score} điểm</strong>
                </div>
              ))}
            </section>
          ) : round ? (
            <section className="round-panel">
              <div className="round-top">
                <span>
                  CÂU {round.number} / {battle?.totalQuestions}
                </span>
                <b>{round.status === 'OPEN' ? `${remaining}s` : 'Kết quả'}</b>
              </div>
              <Progress
                percent={(remaining / 15) * 100}
                showInfo={false}
                strokeColor={remaining < 5 ? '#ef8383' : '#a490ef'}
              />
              <h1>{round.text}</h1>
              <div className="answer-grid">
                {round.options.map((option, i) => (
                  <Button
                    key={i}
                    className={round.correctIndex === i ? 'answer-option correct' : 'answer-option'}
                    disabled={
                      round.status !== 'OPEN' ||
                      remaining === 0 ||
                      round.answered ||
                      !media.camera ||
                      my?.status !== 'ACTIVE' ||
                      busy
                    }
                    onClick={() =>
                      act('answer', {
                        roundId: round.id,
                        optionIndex: i,
                        requestId: crypto.randomUUID(),
                      })
                    }
                  >
                    <b>{String.fromCharCode(65 + i)}</b>
                    <span>{option}</span>
                  </Button>
                ))}
              </div>
              {round.status !== 'OPEN' ? (
                <Alert
                  type={round.winnerId ? 'success' : 'info'}
                  message={
                    round.winnerId
                      ? `${battle?.players.find((p) => p.id === round.winnerId)?.displayName} trả lời đúng đầu tiên! +10 điểm, đối thủ −5 điểm.`
                      : 'Hết thời gian. Không ai bị thay đổi điểm.'
                  }
                />
              ) : round.answered ? (
                <Tag color="blue">Đã nhận đáp án của bạn. Chờ kết quả…</Tag>
              ) : null}
            </section>
          ) : null}
        </main>
        <section className="score-panel">
          <div className="video-grid battle-side-videos" aria-label="Video phía bên phải">
            {sidePlayers.map(renderPlayerVideo)}
          </div>
          <div className="section-label">BẢNG ĐIỂM</div>
          {sorted.map((p) => (
            <div className="score-row" key={p.id}>
              <div className="avatar">{p.displayName[0]}</div>
              <span>
                {p.displayName}
                <small>
                  {p.status === 'ACTIVE'
                    ? 'Đang tham gia'
                    : p.status === 'FORFEITED'
                      ? 'Bỏ cuộc'
                      : 'Đã rời'}
                </small>
              </span>
              <b>{p.score}</b>
            </div>
          ))}
          <p className="muted">
            Camera bắt buộc. Khi mất camera hoặc kết nối, bạn có 30 giây để khôi phục trước khi bị
            tính bỏ cuộc.
          </p>
        </section>
      </div>
    </div>
  );
}
