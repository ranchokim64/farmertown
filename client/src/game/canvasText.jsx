import * as THREE from 'three';
import { useEffect, useMemo } from 'react';

export const FONT = "'Jua', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

// 2D 캔버스에 그린 글자를 텍스처로 사용합니다 (한글 폰트를 외부 CDN 없이 표시).
export function useCanvasTexture(width, height, draw, deps = []) {
  const { canvas, texture } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return { canvas, texture };
  }, [width, height]);

  useEffect(() => {
    const render = () => {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, width, height);
      draw(ctx, width, height);
      texture.needsUpdate = true;
    };
    render();
    let alive = true;
    document.fonts?.load(`40px Jua`).then(() => alive && render());
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 텍스트 판 (간판, 현수막 등)
export function Label({ text, width = 4, height = 1, bg = '#fff4d6', color = '#5a3a1a', fontSize = 0.6, border, ...props }) {
  const px = 128;
  const texture = useCanvasTexture(
    Math.round(width * px),
    Math.round(height * px),
    (ctx, w, h) => {
      if (bg) {
        ctx.fillStyle = bg;
        roundRect(ctx, 4, 4, w - 8, h - 8, Math.min(w, h) * 0.18);
        ctx.fill();
        if (border) {
          ctx.lineWidth = 10;
          ctx.strokeStyle = border;
          ctx.stroke();
        }
      }
      ctx.fillStyle = color;
      ctx.font = `${Math.round(fontSize * px)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = String(text).split('\n');
      lines.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 + (i - (lines.length - 1) / 2) * fontSize * px * 1.15));
    },
    [text, bg, color, fontSize, border],
  );
  return (
    <mesh {...props}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}
