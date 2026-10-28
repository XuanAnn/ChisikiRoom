import React, { useEffect, useState } from 'react';
import { Alert, Button, Modal } from 'antd';
import type { User } from '../../desktop/src/lib/api';

const ChatWorkspace = React.lazy(() =>
  import('../../desktop/src/features/chat/ChatWorkspace').then((module) => ({
    default: module.ChatWorkspace,
  })),
);
const QuizEditor = React.lazy(() =>
  import('../../desktop/src/features/quiz/QuizEditor').then((module) => ({
    default: module.QuizEditor,
  })),
);
const PracticeWindow = React.lazy(() =>
  import('../../desktop/src/features/practice/PracticeWindow').then((module) => ({
    default: module.PracticeWindow,
  })),
);
const BattleWindow = React.lazy(() =>
  import('../../desktop/src/features/battle/BattleWindow').then((module) => ({
    default: module.BattleWindow,
  })),
);
const CallWindow = React.lazy(() =>
  import('../../desktop/src/features/calling/CallWindow').then((module) => ({
    default: module.CallWindow,
  })),
);
const IncomingCallWindow = React.lazy(() =>
  import('../../desktop/src/features/calling/IncomingCallWindow').then((module) => ({
    default: module.IncomingCallWindow,
  })),
);

type Tool = { kind: string; id: string };

export function WebWorkspace({ user, onLogout }: { user: User; onLogout: () => Promise<void> }) {
  const [tool, setTool] = useState<Tool | null>(null);
  const [incoming, setIncoming] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);

  useEffect(
    () =>
      window.chisiki?.onEvent((event) => {
        if (event.type === 'WEB_TOOL') {
          setTool(event.data);
          setError('');
        }
        if (event.type === 'WEB_INCOMING') {
          setIncoming(event.data);
        }
      }),
    [],
  );

  async function close() {
    setClosing(true);
    try {
      const result = await window.chisiki?.closeTool?.();
      setError(result?.error || '');
    } finally {
      setClosing(false);
    }
  }

  function renderTool() {
    if (!tool) {
      return null;
    }
    if (tool.kind === 'quiz') {
      return <QuizEditor key={tool.id} quizId={tool.id === 'new' ? undefined : tool.id} />;
    }
    if (tool.kind === 'practice') {
      return <PracticeWindow key={tool.id} id={tool.id} />;
    }
    if (tool.kind === 'battle') {
      return <BattleWindow key={tool.id} id={tool.id} />;
    }
    if (tool.kind === 'call') {
      return <CallWindow key={tool.id} id={tool.id} />;
    }
    return null;
  }

  return (
    <>
      <div hidden={Boolean(tool)}>
        <ChatWorkspace user={user} onLogout={onLogout} />
      </div>
      {tool && (
        <section className="web-tool" aria-label="Cửa sổ chức năng">
          <div className="web-tool-navigation">
            <Button onClick={close} loading={closing}>
              Quay về trò chuyện
            </Button>
            {error && <Alert type="error" message={error} />}
          </div>
          <React.Suspense fallback={<div className="empty-center">Đang mở…</div>}>
            {renderTool()}
          </React.Suspense>
        </section>
      )}
      <Modal
        open={Boolean(incoming)}
        footer={null}
        closable={false}
        maskClosable={false}
        destroyOnHidden
        width={480}
      >
        <React.Suspense fallback={<div>Đang nhận cuộc gọi…</div>}>
          {incoming && <IncomingCallWindow key={incoming} id={incoming} />}
        </React.Suspense>
      </Modal>
    </>
  );
}
