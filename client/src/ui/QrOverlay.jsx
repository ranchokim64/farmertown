import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { create } from 'zustand';

// 학생들이 태블릿으로 찍어 들어올 게임 주소 (테스트용 ?debug 같은 쿼리는 빼고 사이트 주소만)
// 빌드할 때 VITE_PUBLIC_URL 로 고정할 수도 있음
export const GAME_URL = import.meta.env.VITE_PUBLIC_URL || new URL(import.meta.env.BASE_URL, window.location.origin).href;

// 주소 끝에 ?qr 를 붙여 열면 처음부터 QR 화면을 띄움 (교실 TV 에 띄워 두기용 즐겨찾기)
export const useQr = create((set) => ({
  open: new URLSearchParams(window.location.search).has('qr'),
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));

// 교실 TV/전자칠판에 크게 띄우는 QR 입장 안내
export function QrOverlay() {
  const open = useQr((s) => s.open);
  const hide = useQr((s) => s.hide);
  const canvas = useRef();

  useEffect(() => {
    if (!open || !canvas.current) return undefined;
    const draw = () => {
      // 화면에 맞게 최대한 크게 (멀리 있는 태블릿 카메라로도 잘 찍히도록)
      const size = Math.floor(Math.min(window.innerWidth * 0.7, window.innerHeight * 0.62, 720));
      QRCode.toCanvas(canvas.current, GAME_URL, {
        width: size,
        margin: 4, // QR 표준 여백(4칸): 멀리서 찍어도 잘 인식되게
        errorCorrectionLevel: 'M',
        color: { dark: '#1f1408', light: '#ffffff' },
      });
    };
    draw();
    window.addEventListener('resize', draw);
    const onKey = (e) => e.key === 'Escape' && hide();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', draw);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, hide]);

  if (!open) return null;
  return (
    <div className="qr-bg" onClick={hide}>
      <div className="qr-card" onClick={(e) => e.stopPropagation()}>
        <div className="badge">📱 태블릿 카메라로 찍어 입장하세요</div>
        <canvas ref={canvas} className="qr-code" aria-label={`게임 주소 QR코드: ${GAME_URL}`} />
        <div className="qr-url">{GAME_URL.replace(/^https?:\/\//, '')}</div>
        <p className="muted">🌾 가래떡 마을의 황금 들판 · 11월 11일 농업인의 날</p>
        <button className="btn primary" onClick={hide}>
          닫기
        </button>
      </div>
    </div>
  );
}
