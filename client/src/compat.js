// 오래된 태블릿 브라우저 호환 (예: 크롬 92 이전, 삼성 인터넷 15 이하)
// 이런 브라우저에는 crypto.randomUUID 와 AbortSignal.timeout 이 없습니다.

// UUID v4 (세션 ID). crypto.getRandomValues 는 아주 오래된 브라우저에도 있음
export function uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; // 버전 4
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 변형
  const h = [...b].map((x) => x.toString(16).padStart(2, '0'));
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`;
}

// 일정 시간 뒤 요청을 취소하는 신호
export function timeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}
