import { useEffect, useState } from 'react';
import { Alert, Button, Input, Radio, Space, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import { request, errorMessage, type Question, type Quiz } from '../../lib/api';
const blank = (): Question => ({ text: '', options: ['', '', '', ''], correctIndex: 0 });
export function QuizEditor({ quizId }: { quizId?: string }) {
  const [id, setId] = useState(quizId);
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([blank()]);
  const [selected, setSelected] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(Boolean(quizId));
  const [error, setError] = useState('');
  const [isTemplate, setIsTemplate] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (quizId) {
      request<Quiz>('quiz', { id: quizId })
        .then((q) => {
          setIsTemplate(q.ownerId === null);
          setTitle(q.title);
          setQuestions(q.questions);
        })
        .catch((e) => setError(errorMessage(e)))
        .finally(() => setBusy(false));
    }
  }, [quizId]);
  useEffect(() => {
    window.chisiki?.setDirty(dirty);
    return () => window.chisiki?.setDirty(false);
  }, [dirty]);
  const edit = (values: Partial<Question>) => {
    setQuestions((qs) => qs.map((q, i) => (i === selected ? { ...q, ...values } : q)));
    setDirty(true);
    setSaved(false);
  };
  async function save() {
    if (
      !title.trim() ||
      questions.some((q) => !q.text.trim() || q.options.some((o) => !o.trim()))
    ) {
      setError('Hãy nhập tên bộ câu hỏi, nội dung câu hỏi và tất cả phương án.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saveAction = id && !isTemplate ? 'saveQuiz' : 'createQuiz';
      const quiz = await request<Quiz>(saveAction, { id, title, questions });
      setIsTemplate(false);
      setId(quiz.id);
      setDirty(false);
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const q = questions[selected];
  return (
    <div className="editor">
      <header>
        <div>
          <span className="eyebrow">QUIZ STUDIO</span>
          <h2>{isTemplate ? 'Bộ câu hỏi có sẵn' : 'Bộ câu hỏi của bạn'}</h2>
        </div>
        <Space>
          {dirty ? (
            <Tag color="gold">Chưa lưu</Tag>
          ) : saved ? (
            <Tag color="green">Đã lưu</Tag>
          ) : null}
          <Button type="primary" icon={<SaveOutlined />} onClick={save} loading={busy}>
            {isTemplate ? 'Lưu bản sao cá nhân' : 'Lưu bộ câu hỏi'}
          </Button>
        </Space>
      </header>
      {error && <Alert type="error" message={error} closable onClose={() => setError('')} />}
      {isTemplate && (
        <Alert
          type="info"
          message="Bộ mẫu dùng chung. Mọi chỉnh sửa sẽ được lưu thành bản sao cá nhân; bạn có thể dùng ngay bộ gốc trong Battle."
        />
      )}
      <div className="editor-body">
        <section className="question-list">
          <label>TÊN BỘ CÂU HỎI</label>
          <Input
            value={title}
            maxLength={120}
            placeholder="Ví dụ: Khám phá khoa học"
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
              setSaved(false);
            }}
          />
          <div className="section-label">CÂU HỎI · {questions.length}</div>
          {questions.map((item, i) => (
            <button
              key={i}
              className={selected === i ? 'question-tile active' : 'question-tile'}
              onClick={() => setSelected(i)}
            >
              <b>{String(i + 1).padStart(2, '0')}</b>
              <span>{item.text || 'Câu hỏi mới'}</span>
            </button>
          ))}
          <Button
            block
            icon={<PlusOutlined />}
            disabled={questions.length >= 100}
            onClick={() => {
              setQuestions([...questions, blank()]);
              setSelected(questions.length);
              setDirty(true);
            }}
          >
            Thêm câu hỏi
          </Button>
        </section>
        <section className="question-form">
          <div className="section-label">CÂU {selected + 1}</div>
          <h2>Bạn muốn hỏi điều gì?</h2>
          <Input.TextArea
            autoSize={{ minRows: 3, maxRows: 7 }}
            value={q.text}
            maxLength={2000}
            placeholder="Nhập nội dung câu hỏi…"
            onChange={(e) => edit({ text: e.target.value })}
          />
          <p className="muted">Chọn nút tròn cạnh phương án đúng.</p>
          <Radio.Group
            value={q.correctIndex}
            onChange={(e) => edit({ correctIndex: e.target.value })}
            className="option-editor"
          >
            {q.options.map((option, i) => (
              <div className={q.correctIndex === i ? 'correct-option' : ''} key={i}>
                <Radio value={i} />
                <b>{String.fromCharCode(65 + i)}</b>
                <Input
                  value={option}
                  maxLength={500}
                  placeholder={`Phương án ${String.fromCharCode(65 + i)}`}
                  onChange={(e) =>
                    edit({ options: q.options.map((o, j) => (j === i ? e.target.value : o)) })
                  }
                />
              </div>
            ))}
          </Radio.Group>
          <Button
            danger
            icon={<DeleteOutlined />}
            disabled={questions.length === 1}
            onClick={() => {
              setQuestions(questions.filter((_, i) => i !== selected));
              setSelected(Math.max(0, selected - 1));
              setDirty(true);
            }}
          >
            Xóa câu hỏi
          </Button>
        </section>
      </div>
    </div>
  );
}
