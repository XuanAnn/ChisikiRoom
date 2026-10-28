import { installBrowserAdapter } from './browserAdapter';

// Install before importing shared components, including module-level event listeners.
installBrowserAdapter();

async function mount() {
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { App } = await import('../../desktop/src/app/App');
  const { WebWorkspace } = await import('./WebWorkspace');
  await import('./web.css');

  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <React.Suspense fallback={<div className="empty-center">Đang mở ChisikiRoom…</div>}>
        <App renderWorkspace={(user, logout) => <WebWorkspace user={user} onLogout={logout} />} />
      </React.Suspense>
    </React.StrictMode>,
  );
}

void mount();
