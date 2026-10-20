// Vercel 서버리스 함수: /api/* 요청을 Express 앱으로 처리합니다.
// vercel.json 의 rewrite 가 /api/session/abc → /api?__path=session/abc 로 넘겨 주므로 원래 경로로 되돌립니다.
import { createApp } from '../server/src/app.js';
import { createStore } from '../server/src/stores/index.js';
import { config } from '../server/src/config.js';

let appPromise;
function getApp() {
  appPromise ??= (async () => {
    if (!config.databaseUrl) {
      console.error('[vercel] DATABASE_URL 이 없습니다. Vercel 프로젝트 환경 변수에 Supabase 연결 문자열을 넣어 주세요.');
    }
    const store = await createStore(config);
    // Vercel 프록시 뒤: X-Forwarded-For 맨 앞이 실제 학생 IP
    return createApp({ store, config: { ...config, trustProxy: true, staticDir: '' } });
  })();
  return appPromise;
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const sub = url.searchParams.get('__path');
  if (sub !== null) {
    url.searchParams.delete('__path');
    url.searchParams.delete('route'); // Vercel 이 이름 있는 파라미터를 쿼리로도 붙여 줌
    const qs = url.searchParams.toString();
    req.url = `/api/${sub}${qs ? `?${qs}` : ''}`;
  }
  const app = await getApp();
  return app(req, res);
}
