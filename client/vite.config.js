import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages 는 https://<계정>.github.io/<저장소>/ 아래에서 열리므로 빌드 시 VITE_BASE=/<저장소>/ 지정
  base: process.env.VITE_BASE || '/',
  server: { host: true },
  build: {
    // 학교 태블릿의 오래된 브라우저(크롬 87·삼성 인터넷 14 이상)까지 동작하도록 문법을 맞춤
    target: ['es2020', 'chrome87', 'safari14', 'firefox78', 'edge88'],
    chunkSizeWarningLimit: 1500,
  },
});
