import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, '.', '');
  const backend = environment.BACKEND_URL || 'http://127.0.0.1:8080';

  return {
    plugins: [react()],
    resolve: {
      dedupe: ['react', 'react-dom', 'antd', '@ant-design/icons'],
    },
    server: {
      strictPort: true,
      fs: { allow: ['..'] },
      proxy: {
        '/api': { target: backend, changeOrigin: true },
        '/actuator/health': { target: backend, changeOrigin: true },
        '/ws': {
          target: backend,
          ws: true,
          changeOrigin: true,
          configure(proxy) {
            // The loopback dev server is the browser's same-origin gateway.
            // Authenticate upstream through STOMP Bearer, as Electron does;
            // do not forward the local browser Origin to a remote backend.
            proxy.on('proxyReqWs', (request) => request.removeHeader('origin'));
          },
        },
      },
    },
  };
});
