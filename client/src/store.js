import { create } from 'zustand';
import { api, ApiError } from './api.js';
import { MAIN_QUESTS } from './game/data/quests.js';

const STORAGE_KEY = 'farmertown:v1';

export const OUTFIT_COLORS = {
  overall: ['#4a90e2', '#e2574c', '#3cb371', '#9b6bd6', '#ff9f1c'],
  shirt: ['#fff4d6', '#ffd6e0', '#d6f0ff', '#e6ffd6', '#fff066'],
};

const emptyProgress = () => ({ flags: {}, inventory: [], completed: [], startedAt: Date.now() });

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

const saved = loadSaved();

export const useGame = create((set, get) => ({
  // 'title' | 'intro' | 'play'
  phase: 'title',
  sessionId: saved?.sessionId ?? null,
  profile: saved?.profile ?? null, // { nickname, school: {code, name}, outfit: {overall, shirt} }
  progress: saved?.progress ?? emptyProgress(),
  pending: saved?.pending ?? [], // 서버 전송 대기 중인 퀘스트 완료
  online: true,
  serverScore: null,
  leaderboard: null,
  dialog: null, // { speaker, lines, index }
  toasts: [],
  prompt: null, // 현재 상호작용 안내 문구
  celebrateAt: 0, // 불꽃놀이 시작 시각 (performance.now)
  clearInfo: null, // { timeMs, speedRank }
  showClear: false,

  setPhase: (phase) => set({ phase }),

  // 새 게임 시작: 서버 세션 생성 (실패해도 오프라인으로 진행)
  startNew: async ({ nickname, school, outfit }) => {
    const sessionId = crypto.randomUUID();
    try {
      const s = await api.createSession(sessionId, nickname, school);
      set({ online: true, serverScore: s.score });
      school = s.school;
      nickname = s.nickname;
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) throw err; // 닉네임/학교 오류는 화면에 표시
      set({ online: false });
    }
    set({
      sessionId,
      profile: { nickname, school, outfit },
      progress: emptyProgress(),
      pending: [],
      clearInfo: null,
      showClear: false,
    });
  },

  // 이어하기: 서버의 완료 기록과 로컬 진행도를 합칩니다.
  resume: async () => {
    const { sessionId, progress } = get();
    try {
      const s = await api.getSession(sessionId);
      const completed = [...new Set([...progress.completed, ...s.completed])];
      const pending = completed.filter((q) => !s.completed.includes(q));
      set({
        online: true,
        serverScore: s.score,
        progress: { ...progress, completed },
        pending: sortQuests(pending),
        clearInfo: s.clearTimeMs ? { timeMs: s.clearTimeMs } : null,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // 서버에 세션이 없으면(서버 초기화 등) 같은 UUID 로 다시 등록하고 완료 기록을 재전송
        await get().reRegister();
        set({ pending: sortQuests(get().progress.completed) });
      } else {
        set({ online: false });
      }
    }
    get().flushPending();
  },

  reRegister: async () => {
    const { sessionId, profile } = get();
    try {
      const s = await api.createSession(sessionId, profile.nickname, profile.school);
      set({ online: true, serverScore: s.score });
    } catch {
      set({ online: false });
    }
  },

  resetAll: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* 무시 */
    }
    set({ sessionId: null, profile: null, progress: emptyProgress(), pending: [], clearInfo: null, showClear: false, serverScore: null });
  },

  // ── 진행도 조작 ──
  pick: (itemId) =>
    set((s) =>
      s.progress.inventory.includes(itemId) ? {} : { progress: { ...s.progress, inventory: [...s.progress.inventory, itemId] } },
    ),
  take: (ids) =>
    set((s) => ({ progress: { ...s.progress, inventory: s.progress.inventory.filter((i) => !ids.includes(i)) } })),
  setFlag: (id) => set((s) => ({ progress: { ...s.progress, flags: { ...s.progress.flags, [id]: true } } })),

  complete: (questId) => {
    const { progress } = get();
    if (progress.completed.includes(questId)) return;
    const completed = [...progress.completed, questId];
    set((s) => ({ progress: { ...s.progress, completed }, pending: [...s.pending, questId] }));
    if (questId === 'final') {
      set({ celebrateAt: performance.now(), clearInfo: { timeMs: Date.now() - progress.startedAt } });
      setTimeout(() => set({ showClear: true }), 4500);
    } else {
      const n = MAIN_QUESTS.filter((q) => completed.includes(q)).length;
      get().toast(`🎀 감사 리본 ${n}/5`);
    }
    get().flushPending();
  },

  // 서버 전송 큐: 순서대로 하나씩 보내고, 쿨타임(429)이면 기다렸다가 재시도
  _flushing: false,
  flushPending: async () => {
    if (get()._flushing) return;
    set({ _flushing: true });
    let retryMs = 0;
    try {
      while (get().pending.length && get().sessionId) {
        const questId = get().pending[0];
        try {
          const r = await api.complete(get().sessionId, questId);
          set((s) => ({ online: true, serverScore: r.score, pending: s.pending.slice(1) }));
          if (r.added) get().toast(`🏫 ${get().profile?.school?.name} +${r.added}점!`);
          if (r.clearTimeMs) set({ clearInfo: { timeMs: r.clearTimeMs, speedRank: r.speedRank } });
          get().refreshLeaderboard();
        } catch (err) {
          if (err instanceof ApiError && err.status === 429) {
            retryMs = err.body?.retryAfterMs ?? 3000;
          } else if (err instanceof ApiError && err.status === 404) {
            await get().reRegister();
            retryMs = 1000;
          } else if (err instanceof ApiError && err.status === 400) {
            set((s) => ({ pending: s.pending.slice(1) })); // 복구 불가 요청은 버림
            continue;
          } else {
            set({ online: false });
            retryMs = 8000;
          }
          break;
        }
      }
    } finally {
      set({ _flushing: false });
    }
    if (retryMs) setTimeout(() => get().flushPending(), retryMs + 200);
  },

  refreshLeaderboard: async () => {
    try {
      const lb = await api.leaderboard(get().profile?.school?.code);
      set({ leaderboard: lb, online: true });
    } catch {
      set({ online: false });
    }
  },

  // ── UI ──
  say: (speaker, lines) => set({ dialog: { speaker, lines, index: 0 } }),
  advanceDialog: () => {
    const d = get().dialog;
    if (!d) return;
    if (d.index + 1 < d.lines.length) set({ dialog: { ...d, index: d.index + 1 } });
    else set({ dialog: null });
  },
  toast: (text) => {
    const id = Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, text }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2600);
  },
  setPrompt: (prompt) => get().prompt !== prompt && set({ prompt }),
  closeClear: () => set({ showClear: false }),
}));

function sortQuests(ids) {
  const order = [...MAIN_QUESTS, 'final'];
  return [...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

// 세션 복구용 LocalStorage 저장
useGame.subscribe((s) => {
  if (!s.sessionId) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ sessionId: s.sessionId, profile: s.profile, progress: s.progress, pending: s.pending }),
    );
  } catch {
    /* 사생활 보호 모드 등 */
  }
});
