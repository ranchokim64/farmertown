// 화질 설정: 태블릿처럼 그래픽 성능이 낮은 기기에서도 부드럽게 돌아가도록
// - 터치 기기는 '보통'으로 시작, 그 밖은 '높음'
// - 플레이 중 초당 프레임이 계속 낮으면 한 단계씩 자동으로 낮춤 (기기별로 기억)
// - 화면 오른쪽 위 ⚙ 버튼으로 직접 바꿀 수도 있음
import { create } from 'zustand';

const KEY = 'farmertown:quality';

export const QUALITY = {
  high: { label: '높음', dpr: [1, 1.5], shadows: true, shadowSize: 2048 },
  medium: { label: '보통', dpr: [1, 1.25], shadows: true, shadowSize: 1024 },
  low: { label: '낮음', dpr: [1, 1], shadows: false, shadowSize: 512 },
};
const ORDER = ['high', 'medium', 'low'];

export const isTouchDevice = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

function load() {
  try {
    const v = localStorage.getItem(KEY);
    if (QUALITY[v]) return v;
  } catch {
    /* 무시 */
  }
  return isTouchDevice ? 'medium' : 'high';
}

function save(level) {
  try {
    localStorage.setItem(KEY, level);
  } catch {
    /* 무시 */
  }
}

export const useQuality = create((set, get) => ({
  level: load(),
  set: (level) => {
    save(level);
    set({ level });
  },
  // ⚙ 버튼: 높음 → 보통 → 낮음 → 높음
  cycle: () => {
    const next = ORDER[(ORDER.indexOf(get().level) + 1) % ORDER.length];
    get().set(next);
    return next;
  },
  // 자동으로 한 단계 낮춤 (더 낮출 수 없으면 false)
  lower: () => {
    const i = ORDER.indexOf(get().level);
    if (i >= ORDER.length - 1) return false;
    get().set(ORDER[i + 1]);
    return true;
  },
}));
