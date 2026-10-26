import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Empty, Modal, Select, Tag } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { request, errorMessage, type Battle, type Quiz } from '../../lib/api';
export function BattleCards({ roomId, quizzes }: { roomId: string; quizzes: Quiz[] }) {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [open, setOpen] = useState(false);
  const [quiz, setQuiz] = useState<string>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(
    async () => setBattles(await request<Battle[]>('battles', { roomId })),
    [roomId],
  );
  useEffect(() => {
    refresh().catch((e) => setError(errorMessage(e)));
    return window.chisiki?.onEvent((e) => {
      if (e.data?.battleId || e.type === 'CONNECTION') {
        refresh().catch(() => {});
      }
    });
  }, [refresh]);
  async function create() {
    setBusy(true);
    setError('');
    try {
      if (!quiz) {
        throw new Error('Chọn một bộ câu hỏi trước');
      }
      const battle = await request<Battle>('createBattle', { roomId, questionSetId: quiz });
      setOpen(false);
      await refresh();
      await window.chisiki?.openWindow('battle', battle.id);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="battle-invites">
        <Button icon={<ThunderboltOutlined />} onClick={() => setOpen(true)}>
          Tạo Battle
        </Button>
        {battles
          .filter((b) => b.status === 'WAITING' || b.status === 'IN_PROGRESS')
          .map((b) => (
            <button
              className="battle-invite"
              key={b.id}
              onClick={() => window.chisiki?.openWindow('battle', b.id)}
            >
              <ThunderboltOutlined />
              <span>{b.title}</span>
              <Tag color="purple">
                {b.status === 'WAITING'
                  ? `${b.players.filter((p) => p.status === 'ACTIVE').length}/4 · Tham gia`
                  : 'Đang thi đấu'}
              </Tag>
            </button>
          ))}
      </div>
      {error && <Alert type="error" message={error} closable onClose={() => setError('')} />}
      <Modal
        open={open}
        title="Tạo thử thách mới"
        okText="Tạo Battle"
        cancelText="Hủy"
        confirmLoading={busy}
        onOk={create}
        onCancel={() => setOpen(false)}
      >
        <p className="muted">Tối đa 4 người · 15 giây/câu · +10/−5 điểm.</p>
        {quizzes.length ? (
          <Select
            showSearch
            optionFilterProp="label"
            style={{ width: '100%' }}
            placeholder="Chọn bộ có sẵn hoặc bộ của bạn"
            value={quiz}
            onChange={setQuiz}
            options={quizzes.map((q) => ({
              value: q.id,
              label: `${q.title} · ${q.questions.length} câu`,
            }))}
          />
        ) : (
          <>
            <Empty description="Hãy tạo bộ câu hỏi trước" />
            <Button onClick={() => window.chisiki?.openWindow('quiz')}>Mở Quiz Editor</Button>
          </>
        )}
      </Modal>
    </>
  );
}
