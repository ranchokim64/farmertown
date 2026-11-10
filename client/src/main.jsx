import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// 화면 파일을 정상으로 받았으니 새로고침 표시 지움 (index.html 의 무중단 배포 보조 참고)
try {
  sessionStorage.removeItem('ft-reloaded');
} catch {
  /* 무시 */
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// 디버그용 핸들 (?debug 로 접속 시에만). 점수는 서버가 검증하므로 보안 영향 없음.
if (new URLSearchParams(location.search).has('debug')) {
  Promise.all([import('./store.js'), import('./game/runtime.js'), import('./game/Interaction.jsx'), import('./game/CameraRig.jsx'), import('./sfx.js'), import('./music.js'), import('./game/data/quests.js')]).then(([s, r, i, c, a, m, q]) => {
    window.__ft = { useGame: s.useGame, player: r.player, cam: r.cam, interact: i.interactNow, introCtl: c.introCtl, audioBus: a.audioBus, music: m.music, quests: q };
  });
}
