import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <React.Suspense fallback={<div className="empty-center">Đang mở ChisikiRoom…</div>}>
      <App />
    </React.Suspense>
  </React.StrictMode>,
);
