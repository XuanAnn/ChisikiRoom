import { useState } from 'react';
import { Alert, Button, Drawer, Empty, Tag } from 'antd';
import { request, errorMessage, type PracticeHistory } from '../../lib/api';
import './practice.css';
export function PracticeHistoryPanel() {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<PracticeHistory[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function refresh() {
    setBusy(true);
    setError('');
    try {
      setHistory(await request<PracticeHistory[]>('practiceHistory'));
    } catch (exception) {
      setError(errorMessage(exception));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
          void refresh();
        }}
      >
        Lịch sử luyện tập
      </Button>
      <Drawer
        open={open}
        width={540}
        title="Lịch sử luyện tập · 50 lượt gần nhất"
        onClose={() => setOpen(false)}
      >
        <Button loading={busy} onClick={() => void refresh()}>
          Làm mới
        </Button>
        {error && <Alert type="error" message={error} />}
        <div className="practice-history">
          {history.map((attempt) => (
            <div className="practice-history-row" key={attempt.id}>
              <div>
                <strong>{attempt.title}</strong>
                <p>{new Date(attempt.startedAt).toLocaleString('vi-VN')}</p>
                <Tag>
                  {attempt.finishedAt
                    ? `${attempt.correctCount}/${attempt.questionCount} câu đúng`
                    : 'Đang làm'}
                </Tag>
              </div>
              <Button onClick={() => window.chisiki?.openWindow('practice', attempt.id)}>
                {attempt.finishedAt ? 'Xem kết quả' : 'Làm tiếp'}
              </Button>
            </div>
          ))}
        </div>
        {!busy && !history.length && <Empty description="Chưa có lượt luyện tập" />}
      </Drawer>
    </>
  );
}
