import { useState } from 'react';
import { Button, Empty, Input, Select } from 'antd';
import { ArrowRightOutlined, BookOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { request, errorMessage, type PracticeAttempt, type Quiz } from '../../lib/api';
import { PracticeHistoryPanel } from '../practice/PracticeHistoryPanel';
import { Alert } from 'antd';
import { matchesSearch } from '../../lib/search';

export function QuizLibrary({ quizzes }: { quizzes: Quiz[] }) {
  const [error, setError] = useState('');
  const [starting, setStarting] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const filtered = quizzes
    .filter((quiz) => matchesSearch(quiz.title, query))
    .sort((first, second) => {
      if (sort === 'name') {
        return first.title.localeCompare(second.title, 'vi');
      }
      return Date.parse(second.updatedAt) - Date.parse(first.updatedAt);
    });
  async function startPractice(questionSetId: string) {
    setStarting(questionSetId);
    setError('');
    try {
      const attempt = await request<PracticeAttempt>('startPractice', { questionSetId });
      await window.chisiki?.openWindow('practice', attempt.id);
    } catch (exception) {
      setError(errorMessage(exception));
    } finally {
      setStarting(null);
    }
  }
  const questionCount = quizzes.reduce((sum, quiz) => sum + quiz.questions.length, 0);
  return (
    <div className="quiz-library modern-library">
      <div className="library-intro">
        <span className="eyebrow">THƯ VIỆN CÂU HỎI</span>
        <h1>
          Biến kiến thức
          <br />
          thành thử thách.
        </h1>
        <p>
          {quizzes.length} bộ câu hỏi · {questionCount} câu hỏi. Soạn ở cửa sổ riêng, dùng ngay
          trong Battle.
        </p>
      </div>
      <PracticeHistoryPanel />
      {error && <Alert type="error" message={error} closable onClose={() => setError('')} />}
      <div className="library-filters">
        <Input
          prefix={<SearchOutlined />}
          placeholder="Tìm bộ câu hỏi…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          allowClear
        />
        <Select
          aria-label="Sắp xếp bộ câu hỏi"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'newest', label: 'Mới cập nhật' },
            { value: 'name', label: 'Tên A → Z' },
          ]}
        />
      </div>
      <div className="quiz-grid">
        {filtered.map((quiz) => (
          <article key={quiz.id}>
            <button
              className="quiz-card"
              onClick={() => window.chisiki?.openWindow('quiz', quiz.id)}
            >
              <span className="quiz-card-icon">
                <BookOutlined />
              </span>
              <span className="quiz-count">
                {quiz.questions.length} câu hỏi{quiz.ownerId === null ? ' · Có sẵn' : ''}
              </span>
              <h3>{quiz.title}</h3>
              <p>Cập nhật {new Date(quiz.updatedAt).toLocaleDateString('vi-VN')}</p>
              <span className="quiz-card-link">
                {quiz.ownerId === null ? 'Xem / tạo bản sao' : 'Mở trình soạn'}{' '}
                <ArrowRightOutlined />
              </span>
            </button>
            <Button
              block
              className="practice-launch"
              loading={starting === quiz.id}
              disabled={starting !== null && starting !== quiz.id}
              onClick={() => void startPractice(quiz.id)}
            >
              Luyện tập
            </Button>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <div className="library-empty">
          <Empty
            description={
              query
                ? 'Không tìm thấy bộ câu hỏi phù hợp'
                : 'Bắt đầu xây dựng thư viện kiến thức của bạn'
            }
          />
          {!query && (
            <Button icon={<PlusOutlined />} onClick={() => window.chisiki?.openWindow('quiz')}>
              Soạn bộ đầu tiên
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
