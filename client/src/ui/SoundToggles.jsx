import { useEffect, useState } from 'react';
import { sfx } from '../sfx.js';
import { music } from '../music.js';
import { useQuality, QUALITY, isTouchDevice } from '../quality.js';
import { canFullscreen, isFullscreen, toggleFullscreen } from '../fullscreen.js';
import { useGame } from '../store.js';

// 화면 오른쪽 위 버튼들: 전체 화면(태블릿) / 화질 / 배경음악(B) / 효과음(M)
export function SoundToggles() {
  const [sfxMuted, setSfxMuted] = useState(sfx.isMuted());
  const [musicMuted, setMusicMuted] = useState(music.isMuted());
  const [full, setFull] = useState(false);
  const quality = useQuality((s) => s.level);
  useEffect(() => {
    const offs = [sfx.subscribe(setSfxMuted), music.subscribe(setMusicMuted)];
    const onFull = () => setFull(isFullscreen());
    document.addEventListener('fullscreenchange', onFull);
    document.addEventListener('webkitfullscreenchange', onFull);
    return () => {
      offs.forEach((off) => off());
      document.removeEventListener('fullscreenchange', onFull);
      document.removeEventListener('webkitfullscreenchange', onFull);
    };
  }, []);
  const cycleQuality = () => {
    const next = useQuality.getState().cycle();
    useGame.getState().toast(`화질: ${QUALITY[next].label}`);
  };
  return (
    <div className="sound-toggles">
      {isTouchDevice && canFullscreen && (
        <button title="전체 화면" aria-label="전체 화면 켜기/끄기" className={full ? '' : 'off'} onClick={toggleFullscreen}>
          ⛶
        </button>
      )}
      <button title={`화질: ${QUALITY[quality].label}`} aria-label="화질 바꾸기" className="quality" onClick={cycleQuality}>
        ⚙<small>{QUALITY[quality].label}</small>
      </button>
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
