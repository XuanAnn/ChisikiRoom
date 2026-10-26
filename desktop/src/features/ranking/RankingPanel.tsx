import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Empty, Segmented, Space, Statistic, Table, Tag } from 'antd';
import {
  request,
  errorMessage,
  type RankBoard,
  type RankedQueue,
  type RankedHistory,
} from '../../lib/api';
import './ranking.css';
export function RankingPanel() {
  const [level, setLevel] = useState('N5');
  const [board, setBoard] = useState<RankBoard | null>(null);
  const [queue, setQueue] = useState<RankedQueue | null>(null);
  const [history, setHistory] = useState<RankedHistory[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const openedMatch = useRef<string | null>(null);
  const selectedLevel = useRef(level);
  selectedLevel.current = level;
  useEffect(() => {
    let mounted = true;
    let pending = false;
    setBoard(null);
    setLoading(true);
    async function refresh() {
      if (pending) {
        return;
      }
      pending = true;
      try {
        const [nextBoard, nextQueue, nextHistory] = await Promise.all([
          request<RankBoard>('ranking', { level }),
          request<RankedQueue>('rankedHeartbeat'),
          request<RankedHistory[]>('rankedHistory'),
        ]);
        if (!mounted || selectedLevel.current !== level) {
          return;
        }
        setBoard(nextBoard);
        setQueue(nextQueue);
        if (nextQueue.level && nextQueue.status !== 'IDLE' && nextQueue.level !== level) {
          setLevel(nextQueue.level);
          return;
        }
        setHistory(nextHistory);
        setError('');
        if (
          nextQueue.status === 'MATCHED' &&
          nextQueue.battleId &&
          openedMatch.current !== nextQueue.battleId
        ) {
          openedMatch.current = nextQueue.battleId;
          await window.chisiki?.openWindow('battle', nextQueue.battleId);
        }
      } catch (exception) {
        if (mounted) {
          setError(errorMessage(exception));
        }
      } finally {
        pending = false;
        if (mounted) {
          setLoading(false);
        }
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 2500);
    const unsubscribe = window.chisiki?.onEvent((event) => {
      if (event.type === 'RANKED_MATCHED' || event.type === 'RANKED_SETTLED') {
        void refresh();
      }
    });
    return () => {
      mounted = false;
      window.clearInterval(timer);
      unsubscribe?.();
    };
  }, [level]);
  async function changeQueue(cancel = false) {
    setBusy(true);
    setError('');
    try {
      setQueue(
        await request<RankedQueue>(cancel ? 'cancelRankedQueue' : 'joinRankedQueue', { level }),
      );
    } catch (exception) {
      setError(errorMessage(exception));
    } finally {
      setBusy(false);
    }
  }
  async function openMatch() {
    if (!queue?.battleId) {
      return;
    }
    try {
      await window.chisiki?.openWindow('battle', queue.battleId);
    } catch (exception) {
      setError(errorMessage(exception));
    }
  }
  const searching = queue?.status === 'QUEUED';
  const matched = queue?.status === 'MATCHED';
  const active = searching || matched;
  const resultNames: Record<string, string> = {
    WIN: 'Thắng',
    LOSS: 'Thua',
    DRAW: 'Hòa',
    VOID: 'Không tính hạng',
  };
  return (
    <div className="ranking-panel">
      <section className="ranking-intro">
        <div>
          <span className="eyebrow">THI ĐẤU TOÀN HỆ THỐNG</span>
          <h1>Thử sức cùng đối thủ mới.</h1>
          <p>
            Xếp hạng theo kết quả và sức mạnh đối thủ, không theo tổng câu đúng hay số lần tham gia.
          </p>
          <Tag color="purple">Mùa {board?.season.id || '…'} · 8 tuần</Tag>
          <Tag>5 trận phân hạng</Tag>
        </div>
        <Segmented
          aria-label="Trình độ xếp hạng"
          value={level}
          disabled={active}
          onChange={(value) => setLevel(String(value))}
          options={['N5', 'N4']}
        />
      </section>
      {error && <Alert type="error" message={error} />}
      <section className="ranked-matchmaking">
        <div className="ranking-statistics">
          <Statistic title="Rating của bạn" value={board?.me.rating ?? 1500} precision={1} />
          <Statistic title="Trận xếp hạng" value={board?.me.games || 0} />
          <Statistic
            title="Thắng / hòa"
            value={`${board?.me.wins || 0} / ${board?.me.draws || 0}`}
          />
        </div>
        <Tag color={board?.me.provisional ? 'gold' : 'green'}>
          {board?.me.provisional
            ? `Đang phân hạng · ${Math.min(5, board.me.games)}/5`
            : 'Đã phân hạng'}
        </Tag>
        <div className="ranked-search">
          <div>
            <h3>
              {matched
                ? 'Đã tìm thấy đối thủ'
                : searching
                  ? `Đang tìm đối thủ ${queue?.level}…`
                  : `Sẵn sàng đấu ${level}?`}
            </h3>
            <p>1–1 · 10 câu ngẫu nhiên · 15 giây/câu · Camera bắt buộc</p>
          </div>
          <Space>
            {active ? (
              <>
                <Button loading={busy} onClick={() => void changeQueue(true)}>
                  Hủy tìm / hủy lobby
                </Button>
                {matched && (
                  <Button type="primary" onClick={() => void openMatch()}>
                    Mở trận xếp hạng
                  </Button>
                )}
              </>
            ) : (
              <Button
                type="primary"
                loading={busy || loading}
                disabled={loading}
                onClick={() => void changeQueue()}
              >
                Tìm trận xếp hạng
              </Button>
            )}
          </Space>
        </div>
        <p className="muted">
          Giữ trang này mở khi tìm trận. Sau khi ghép, có 60 giây để cả hai bật camera và sẵn sàng;
          trận chưa bắt đầu bị hủy sẽ không tính hạng. Rời trận đang chạy tính thua. Hệ thống hạn
          chế gặp lại cùng người trong 5 phút và tối đa 3 trận/cặp trong 24 giờ.
        </p>
      </section>
      <section>
        <h2>Bảng xếp hạng {level}</h2>
        <p>Top 100 người đã đủ 5 trận trong mùa. Bảng bao gồm mọi tài khoản trên cùng máy chủ.</p>
        <Table
          rowKey="userId"
          pagination={false}
          dataSource={board?.leaders || []}
          locale={{ emptyText: <Empty description="Chưa có người hoàn thành phân hạng" /> }}
          columns={[
            { title: 'Hạng', key: 'rank', render: (_value, _entry, index) => index + 1 },
            { title: 'Người chơi', dataIndex: 'displayName' },
            { title: 'Rating', dataIndex: 'rating', render: (rating: number) => rating.toFixed(1) },
            { title: 'Trận', dataIndex: 'games' },
            { title: 'Thắng', dataIndex: 'wins' },
          ]}
        />
      </section>
      <section>
        <h2>Lịch sử đối đầu</h2>
        <div className="ranked-history">
          {history.map((match) => (
            <div key={match.battleId}>
              <div>
                <strong>{match.opponent}</strong>
                <p>
                  {match.level} · Mùa {match.season} ·{' '}
                  {new Date(match.createdAt).toLocaleString('vi-VN')}
                </p>
              </div>
              <Tag>{match.outcome ? resultNames[match.outcome] : 'Đang đấu / chờ sẵn sàng'}</Tag>
              <span>
                {match.before !== null && match.after !== null
                  ? `${match.before.toFixed(1)} → ${match.after.toFixed(1)}`
                  : '—'}
              </span>
            </div>
          ))}
        </div>
        {!history.length && <Empty description="Chưa có trận xếp hạng" />}
      </section>
    </div>
  );
}
