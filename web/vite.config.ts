import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 开发模式下 /api 请求代理到后端服务
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
