import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 前端构建与开发配置
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // 开发环境将 /api 请求代理到后端，避免跨域问题
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3001', changeOrigin: true }
    }
  },
  build: { outDir: 'dist', sourcemap: false }
})