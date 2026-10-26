import { useEffect, useRef, useState } from 'react';
import { Alert, Button, InputNumber, Progress, Space, Statistic } from 'antd';
import { request, errorMessage, type LearningProgress } from '../../lib/api';
import './practice.css';
export function LearningProgressPanel() {
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [goal, setGoal] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const loadedGoal = useRef(false);
  useEffect(() => {
    let mounted = true;
    async function refresh() {
      try {
        const next = await request<LearningProgress>('learningProgress');
        if (mounted) {
          setProgress(next);
          if (!loadedGoal.current) {
            setGoal(next.dailyGoal);
            loadedGoal.current = true;
          }
          setError('');
        }
      } catch (exception) {
        if (mounted) {
          setError(errorMessage(exception));
        }
      }
    }
    void refresh();
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      mounted = false;
      window.removeEventListener('focus', refresh);
      window.clearInterval(timer);
    };
  }, []);
  async function saveGoal() {
    setBusy(true);
    setError('');
    try {
      setProgress(await request<LearningProgress>('saveLearningGoal', { dailyQuestions: goal }));
    } catch (exception) {
      setError(errorMessage(exception));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="learning-progress" aria-label="Tiến độ học tập">
      {error && <Alert type="error" message={error} />}
      <div className="learning-statistics">
        <Statistic title="Bài đã hoàn thành" value={progress?.completedAttempts || 0} />
        <Statistic
          title="Câu đúng / tổng câu đã nộp"
          value={`${progress?.correctAnswers || 0} / ${progress?.totalQuestions || 0}`}
        />
        <Statistic title="Độ chính xác" value={progress?.accuracy || 0} suffix="%" />
      </div>
      <div className="learning-goal">
        <div>
          <h3>
            Mục tiêu hôm nay · {progress?.todayAnswered || 0}/{progress?.dailyGoal || 20} câu
          </h3>
          <p>
            Chỉ tính câu đã chọn trong bài đã nộp · Ngày theo giờ Việt Nam · Không cộng điểm xếp
            hạng
          </p>
          <Progress
            percent={Math.min(
              100,
              Math.round((100 * (progress?.todayAnswered || 0)) / (progress?.dailyGoal || 20)),
            )}
          />
        </div>
        <Space>
          <InputNumber
            aria-label="Mục tiêu số câu mỗi ngày"
            min={1}
            max={200}
            value={goal}
            onChange={(value) => {
              if (value !== null) {
                setGoal(value);
              }
            }}
          />
          <Button loading={busy} onClick={saveGoal}>
            Lưu mục tiêu
          </Button>
        </Space>
      </div>
    </section>
  );
}
