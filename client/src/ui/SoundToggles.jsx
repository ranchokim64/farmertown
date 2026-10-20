import { useEffect, useState } from 'react';
import { sfx } from '../sfx.js';
import { music } from '../music.js';

// 효과음(M) / 배경음악(B) 켜기·끄기 버튼
export function SoundToggles() {
  const [sfxMuted, setSfxMuted] = useState(sfx.isMuted());
  const [musicMuted, setMusicMuted] = useState(music.isMuted());
  useEffect(() => {
    const offs = [sfx.subscribe(setSfxMuted), music.subscribe(setMusicMuted)];
    return () => offs.forEach((off) => off());
  }, []);
  return (
    <div className="sound-toggles">
      <button title="배경음악 켜기/끄기 (B)" aria-label="배경음악 켜기/끄기" className={musicMuted ? 'off' : ''} onClick={() => music.setMuted(!musicMuted)}>
        🎵
      </button>
      <button title="효과음 켜기/끄기 (M)" aria-label="효과음 켜기/끄기" className={sfxMuted ? 'off' : ''} onClick={() => sfx.setMuted(!sfxMuted)}>
        {sfxMuted ? '🔇' : '🔊'}
      </button>
    </div>
  );
}

// 단축키는 화면과 상관없이 한 번만 등록
const isTyping = (e) => ['INPUT', 'TEXTAREA'].includes(e.target?.tagName);
window.addEventListener('keydown', (e) => {
  if (e.repeat || isTyping(e)) return;
  if (e.code === 'KeyM') sfx.setMuted(!sfx.isMuted());
  if (e.code === 'KeyB') music.setMuted(!music.isMuted());
});
