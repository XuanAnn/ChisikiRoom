import { useEffect, useState } from 'react';
import { Alert, Button, Progress, Radio, Space, Tag } from 'antd';
import { request, errorMessage, type PracticeAttempt } from '../../lib/api';
import './practice.css';

export function PracticeWindow({ id }: { id: string }) {
  const [attempt, setAttempt] = useState<PracticeAttempt | null>(null);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    setAttempt(null);
    setSelected(0);
    request<PracticeAttempt>('practice', { id })
      .then((value) => {
        if (current) {
          setAttempt(value);
        }
      })
      .catch((exception) => {
        if (current) {
          setError(errorMessage(exception));
        }
      });
    return () => {
      current = false;
    };
  }, [id]);

  async function saveAnswers(answers: number[], submit = false) {
    if (busy) {
      return;
    }
    const previousAttempt = attempt;
    setBusy(true);
    setError('');
    if (!submit && attempt) {
      setAttempt({ ...attempt, answers });
    }
    try {
      const action = submit ? 'submitPractice' : 'savePractice';
      setAttempt(await request<PracticeAttempt>(action, { id, answers }));
    } catch (exception) {
      setAttempt(previousAttempt);
      setError(errorMessage(exception));
    } finally {
      setBusy(false);
    }
  }

  async function retryMistakes() {
    setBusy(true);
    setError('');
    try {
      const next = await request<PracticeAttempt>('retryMistakes', { id });
      await window.chisiki?.openWindow('practice', next.id);
    } catch (exception) {
      setError(errorMessage(exception));
    } finally {
      setBusy(false);
    }
  }

  if (!attempt) {
    return (
      <div className="practice-window">
        <Alert type={error ? 'error' : 'info'} message={error || 'Đang tải bài luyện tập…'} />
      </div>
    );
  }
  const completed = attempt.finishedAt !== null;
  const question = attempt.questions[selected];
  const answeredCount = attempt.answers.filter((answer) => answer >= 0).length;
  const correctCount = attempt.correctCount || 0;
  const percentage = Math.round((correctCount / attempt.questions.length) * 100);
  const answer = attempt.answers[selected];
  const correctAnswer = question.correctIndex === answer;
  let resultText = 'Câu trả lời chưa đúng';
  if (answer === -1) {
    resultText = 'Bạn đã bỏ qua câu này';
  } else if (correctAnswer) {
    resultText = 'Bạn trả lời đúng';
  }
  return (
    <div className="practice-window">
      <header>
        <div>
          <span className="eyebrow">LUYỆN TẬP CÁ NHÂN</span>
          <h2>{attempt.title}</h2>
        </div>
        <Tag>{completed ? 'Đã chấm bài' : 'Tự lưu sau mỗi lựa chọn'}</Tag>
      </header>
      {error && <Alert type="error" message={error} closable onClose={() => setError('')} />}
      {completed && (
        <section className="practice-result">
          <strong>
            {correctCount}/{attempt.questions.length}
          </strong>
          <div>
            <h2>Đúng {percentage}%</h2>
            <p>Chọn câu để xem đáp án và giải thích. Điểm luyện tập không ảnh hưởng xếp hạng.</p>
          </div>
          <Button
            disabled={correctCount === attempt.questions.length}
            loading={busy}
            onClick={retryMistakes}
          >
            Ôn câu sai / bỏ qua
          </Button>
        </section>
      )}
      <div className="practice-body">
        <aside className="practice-navigation">
          <h3>{completed ? 'Xem lại bài' : 'Tiến trình'}</h3>
          <Progress percent={Math.round((answeredCount / attempt.questions.length) * 100)} />
          <p>
            {answeredCount}/{attempt.questions.length} câu đã chọn
          </p>
          <div className="practice-numbers">
            {attempt.questions.map((item, index) => {
              let status = 'unanswered';
              if (attempt.answers[index] >= 0) {
                status = 'answered';
              }
              if (completed && attempt.answers[index] === item.correctIndex) {
                status = 'correct';
              }
              if (completed && attempt.answers[index] !== item.correctIndex) {
                status = 'incorrect';
              }
              return (
                <button
                  key={index}
                  className={`${status} ${selected === index ? 'selected' : ''}`}
                  aria-label={`Câu ${index + 1}`}
                  aria-current={selected === index ? 'step' : undefined}
                  onClick={() => setSelected(index)}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <p className="muted">Có thể đóng cửa sổ và làm tiếp từ lịch sử luyện tập.</p>
        </aside>
        <main className="practice-question">
          <span className="eyebrow">
            CÂU {selected + 1} / {attempt.questions.length}
          </span>
          <h1>{question.text}</h1>
          <Radio.Group
            value={answer}
            disabled={busy || completed}
            onChange={(event) => {
              const answers = [...attempt.answers];
              answers[selected] = event.target.value;
              void saveAnswers(answers);
            }}
          >
            {question.options.map((option, index) => (
              <Radio key={index} value={index}>
                <b>{String.fromCharCode(65 + index)}.</b> {option}
              </Radio>
            ))}
          </Radio.Group>
          {completed && question.correctIndex !== null && (
            <Alert
              className="practice-explanation"
              type={correctAnswer ? 'success' : 'info'}
              message={`${resultText} · Đáp án: ${String.fromCharCode(65 + question.correctIndex)}. ${question.options[question.correctIndex]}`}
              description={question.explanation || 'Bộ câu hỏi này chưa có giải thích chi tiết.'}
            />
          )}
          <Space wrap className="practice-actions">
            <Button disabled={selected === 0} onClick={() => setSelected(selected - 1)}>
              Câu trước
            </Button>
            <Button
              disabled={selected === attempt.questions.length - 1}
              onClick={() => setSelected(selected + 1)}
            >
              Câu tiếp
            </Button>
            {!completed && (
              <>
                <Button
                  disabled={busy || answer === -1}
                  onClick={() => {
                    const answers = [...attempt.answers];
                    answers[selected] = -1;
                    void saveAnswers(answers);
                  }}
                >
                  Bỏ chọn
                </Button>
                <Button
                  type="primary"
                  loading={busy}
                  onClick={() => void saveAnswers(attempt.answers, true)}
                >
                  Nộp bài ({answeredCount}/{attempt.questions.length})
                </Button>
              </>
            )}
          </Space>
        </main>
      </div>
    </div>
  );
}
