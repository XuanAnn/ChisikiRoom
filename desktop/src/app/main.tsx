import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Alert, Button, ConfigProvider, Form, Input, Tabs, theme } from 'antd';
import { BookOutlined, ThunderboltOutlined, MessageOutlined } from '@ant-design/icons';
import { request, errorMessage, type User } from '../lib/api';
const ChatWorkspace = React.lazy(() =>
  import('../features/chat/ChatWorkspace').then((module) => ({ default: module.ChatWorkspace })),
);
const QuizEditor = React.lazy(() =>
  import('../features/quiz/QuizEditor').then((module) => ({ default: module.QuizEditor })),
);
const BattleWindow = React.lazy(() =>
  import('../features/battle/BattleWindow').then((module) => ({ default: module.BattleWindow })),
);
const CallWindow = React.lazy(() =>
  import('../features/calling/CallWindow').then((module) => ({ default: module.CallWindow })),
);
const IncomingCallWindow = React.lazy(() =>
  import('../features/calling/IncomingCallWindow').then((module) => ({
    default: module.IncomingCallWindow,
  })),
);
import { ServerSettings } from '../features/auth/ServerSettings';
import '../features/battle/battle.css';
import './style.css';
import '../features/chat/workspace.css';
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(
    () =>
      window.chisiki?.onEvent((event) => {
        if (event.type === 'SIGNED_OUT') {
          setUser(null);
        }
        if (event.type === 'PROFILE_CHANGED') {
          request<User>('me')
            .then(setUser)
            .catch(() => {});
        }
      }),
    [],
  );
  async function submit(values: unknown) {
    setBusy(true);
    setError('');
    try {
      const session = await request(mode, values);
      setUser(session.user);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError('');
    try {
      await request('logout');
      setUser(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function renderContent() {
    if (location.hash.startsWith('#incoming/')) {
      return <IncomingCallWindow id={location.hash.slice(10)} />;
    }
    if (location.hash.startsWith('#call/')) {
      return <CallWindow id={location.hash.slice(6)} />;
    }
    if (location.hash.startsWith('#battle/')) {
      return <BattleWindow id={location.hash.slice(8)} />;
    }
    if (location.hash.startsWith('#quiz/')) {
      return (
        <QuizEditor
          quizId={location.hash.slice(6) === 'new' ? undefined : location.hash.slice(6)}
        />
      );
    }
    if (user) {
      return (
        <>
          <ChatWorkspace user={user} onLogout={logout} />
          {error && (
            <Alert
              type="error"
              message={error}
              className="global-error"
              closable
              onClose={() => setError('')}
            />
          )}
        </>
      );
    }
    return (
      <div className="app">
        <nav className="rail">
          <div className="brand">知</div>
          <MessageOutlined />
          <BookOutlined />
          <ThunderboltOutlined />
        </nav>
        <main>
          <header>
            <span>ChisikiRoom</span>
            <ServerSettings />
          </header>
          <div className="welcome">
            <section className="intro">
              <div className="eyebrow">KIẾN THỨC KẾT NỐI CHÚNG TA</div>
              <h1>
                Học cùng bạn.
                <br />
                <em>Tiến xa hơn.</em>
              </h1>
              <p>
                Không gian trò chuyện, chia sẻ kiến thức và thi đấu trắc nghiệm cùng những người
                bạn.
              </p>
              <div className="features">
                <span>
                  <MessageOutlined /> Trò chuyện
                </span>
                <span>
                  <BookOutlined /> Tạo quiz
                </span>
                <span>
                  <ThunderboltOutlined /> Battle realtime
                </span>
              </div>
            </section>
            <section className="auth">
              <h2>Bắt đầu kết nối</h2>
              <p>Chào mừng bạn đến với ChisikiRoom.</p>
              <Tabs
                activeKey={mode}
                onChange={(key) => {
                  setMode(key);
                  setError('');
                }}
                items={[
                  { key: 'login', label: 'Đăng nhập' },
                  { key: 'register', label: 'Tạo tài khoản' },
                ]}
              />
              {error && <Alert type="error" showIcon message={error} />}
              <Form key={mode} layout="vertical" onFinish={submit} requiredMark={false}>
                {mode === 'register' && (
                  <Form.Item
                    name="displayName"
                    label="Tên hiển thị"
                    rules={[
                      {
                        required: true,
                        min: 2,
                        max: 60,
                        whitespace: true,
                        message: 'Nhập tên từ 2–60 ký tự',
                      },
                    ]}
                  >
                    <Input size="large" autoComplete="nickname" />
                  </Form.Item>
                )}
                <Form.Item
                  name="email"
                  label="Email"
                  rules={[{ required: true, type: 'email', message: 'Nhập email hợp lệ' }]}
                >
                  <Input
                    size="large"
                    placeholder="ban@example.com"
                    autoComplete="email"
                    maxLength={254}
                  />
                </Form.Item>
                <Form.Item
                  name="password"
                  label="Mật khẩu"
                  rules={[
                    {
                      required: true,
                      min: mode === 'register' ? 10 : 1,
                      max: 72,
                      message: 'Kiểm tra độ dài mật khẩu',
                    },
                  ]}
                >
                  <Input.Password
                    size="large"
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  />
                </Form.Item>
                <Button block type="primary" size="large" htmlType="submit" loading={busy}>
                  {mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
                </Button>
              </Form>
            </section>
          </div>
        </main>
      </div>
    );
  }
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: { colorPrimary: '#9484ff', borderRadius: 10, fontFamily: 'Segoe UI, sans-serif' },
      }}
    >
      {renderContent()}
    </ConfigProvider>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <React.Suspense fallback={<div className="empty-center">Đang mở ChisikiRoom…</div>}>
      <App />
    </React.Suspense>
  </React.StrictMode>,
);
