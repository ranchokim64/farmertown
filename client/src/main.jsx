import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// 디버그용 핸들 (?debug 로 접속 시에만). 점수는 서버가 검증하므로 보안 영향 없음.
if (new URLSearchParams(location.search).has('debug')) {
  Promise.all([import('./store.js'), import('./game/runtime.js'), import('./game/Interaction.jsx'), import('./game/CameraRig.jsx')]).then(([s, r, i, c]) => {
    window.__ft = { useGame: s.useGame, player: r.player, cam: r.cam, interact: i.interactNow, introCtl: c.introCtl };
  });
}
