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
        '/api': { target: backend },
        '/actuator/health': { target: backend },
        '/ws': { target: backend, ws: true },
      },
    },
  };
});
