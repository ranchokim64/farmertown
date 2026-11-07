import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages 는 https://<계정>.github.io/<저장소>/ 아래에서 열리므로 빌드 시 VITE_BASE=/<저장소>/ 지정
  base: process.env.VITE_BASE || '/',
  server: { host: true },
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
