import { create } from 'zustand';
import { api, ApiError } from './api.js';
import { MAIN_QUESTS, QUESTS, QUEST_START_ITEMS } from './game/data/quests.js';
import { sfx } from './sfx.js';
import { uuid } from './compat.js';
import { FINAL_QUIZ_KEY } from './game/data/story.js';
import { music } from './music.js';
import { resetPlayer } from './game/runtime.js';

const STORAGE_KEY = 'farmertown:v1';

export const OUTFIT_COLORS = {
  overall: ['#4a90e2', '#e2574c', '#3cb371', '#9b6bd6', '#ff9f1c'],
  shirt: ['#fff4d6', '#ffd6e0', '#d6f0ff', '#e6ffd6', '#fff066'],
};

// tutorial: 촌장님 튜토리얼 단계 (game/data/story.js 의 TUTORIAL_STEPS)
const emptyProgress = () => ({ flags: {}, inventory: [], completed: [], startedAt: Date.now(), tutorial: 'greet' });

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

const saved = loadSaved();
// 튜토리얼 이전 버전의 저장 데이터: 이미 플레이한 흔적이 있으면 튜토리얼은 건너뜀
if (saved?.progress && !saved.progress.tutorial) {
  const p = saved.progress;
  const played = p.completed?.length || p.inventory?.length || Object.keys(p.flags ?? {}).length;
  p.tutorial = played ? 'done' : 'greet';
}

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
  dialog: null, // { speaker, lines, index, onClose }
  quiz: null, // { kind: 'ox'|'final', q?, onPass? } — 열려 있는 동안 이동·E 잠금
  tutorialFlash: null, // 튜토리얼 단계 완료 순간의 "잘했어요!" 표시 { at }
  toasts: [],
  prompt: null, // 현재 상호작용 안내 문구
  celebrateAt: 0, // 불꽃놀이 시작 시각 (performance.now)
  clearInfo: null, // { timeMs, speedRank }
  showClear: false,

  setPhase: (phase) => set({ phase }),

  // 새 게임 시작: 서버 세션 생성 (실패해도 오프라인으로 진행)
  startNew: async ({ nickname, school, outfit }) => {
    const sessionId = uuid();
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
      // 서버 기록을 로컬 진행에 합치지 않음: '처음부터 다시하기'로 지운 진행이 새로고침 때 되살아나지 않게.
      // 로컬에서 끝냈지만 서버에 아직 없는 미션만 다시 보냄.
      const pending = progress.completed.filter((q) => !s.completed.includes(q));
      set({
        online: true,
        serverScore: s.score,
        pending: sortQuests(pending),
        clearInfo: s.clearTimeMs ? { timeMs: s.clearTimeMs } : null,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // 서버에 세션이 없으면(서버 초기화 등) 같은 UUID 로 다시 등록하고 완료 기록을 재전송
        await get().reRegister();
        const all = [...get().progress.completed, ...(get().progress.flags.quiz_passed ? ['quiz'] : [])];
        set({ pending: sortQuests(all) });
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

  // ↺ 처음부터 다시하기: 닉네임·학교·세션은 그대로, 진행만 처음으로.
  // 서버는 이미 끝낸 미션에 다시 점수를 주지 않으므로(멱등) 학교 점수와 클리어 기록은 그대로 남음.
  restartProgress: () => {
    const replays = (get().progress.replays ?? 0) + 1;
    set({
      progress: { ...emptyProgress(), tutorial: 'done', replays },
      pending: [],
      dialog: null,
      quiz: null,
      prompt: null,
      showClear: false,
      celebrateAt: 0,
      tutorialFlash: null,
    });
    resetPlayer();
    get().toast('↺ 처음부터 다시 시작해요! (학교 점수와 클리어 기록은 그대로예요)');
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
  pick: (itemId) => {
    if (!get().progress.inventory.includes(itemId)) sfx.play('pickup');
    set((s) =>
      s.progress.inventory.includes(itemId) ? {} : { progress: { ...s.progress, inventory: [...s.progress.inventory, itemId] } },
    );
  },
  take: (ids) =>
    set((s) => ({ progress: { ...s.progress, inventory: s.progress.inventory.filter((i) => !ids.includes(i)) } })),
  setFlag: (id) => set((s) => ({ progress: { ...s.progress, flags: { ...s.progress.flags, [id]: true } } })),

  // NPC 에게 미션을 맡음: 시작 표시 + 받는 물건 + 알림
  startQuest: (questId) => {
    if (get().progress.flags[`start_${questId}`]) return;
    get().setFlag(`start_${questId}`);
    (QUEST_START_ITEMS[questId] ?? []).forEach((id) => get().pick(id));
    const title = QUESTS.find((q) => q.id === questId)?.title;
    get().toast(`📜 새 미션: ${title}`);
  },

  complete: (questId) => {
    const { progress } = get();
    if (progress.completed.includes(questId)) return;
    const completed = [...progress.completed, questId];
    set((s) => ({ progress: { ...s.progress, completed }, pending: [...s.pending, questId] }));
    sfx.play(questId === 'final' ? 'clear' : 'quest');
    music.duck(questId === 'final' ? 5 : 1.5);
    if (questId === 'final') {
      set({ celebrateAt: performance.now(), clearInfo: { timeMs: Date.now() - progress.startedAt } });
      setTimeout(() => set({ showClear: true }), 4500);
    } else {
      const n = MAIN_QUESTS.filter((q) => completed.includes(q)).length;
      get().toast(`🎀 감사 리본 ${n}/5 · 📒 배움 노트에 적었어요`);
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
          const r = questId === 'quiz'
            ? await api.finalQuiz(get().sessionId, FINAL_QUIZ_KEY)
            : await api.complete(get().sessionId, questId);
          set((s) => ({ online: true, serverScore: r.score ?? s.serverScore, pending: s.pending.slice(1) }));
          if (questId === 'quiz' && r.passed === false) continue; // 정답 키가 다름(버전 차이) — 조용히 버림
          if (r.added) sfx.play('coin');
          if (r.added) get().toast(`🏫 ${get().profile?.school?.name} +${r.added}점!${questId === 'quiz' ? ' (보너스 퀴즈)' : ''}`);
          else if (questId === 'quiz') get().toast('🏆 보너스 점수는 처음 맞혔을 때 이미 받았어요');
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

  // ── 퀴즈 ──
  openQuiz: (quiz) => set({ quiz, prompt: null }),
  closeQuiz: () => set({ quiz: null }),
  // 최종 보너스 퀴즈 통과: 한 사람 1번만 서버가 +20 (다시하기 후 재통과는 +0)
  passFinalQuiz: () => {
    const { progress } = get();
    if (progress.flags.quiz_passed) return;
    set((s) => ({
      progress: { ...s.progress, flags: { ...s.progress.flags, quiz_passed: true } },
      pending: [...s.pending, 'quiz'],
    }));
    get().flushPending();
  },

  // ── UI ──
  // onClose: 마지막 줄까지 읽고 닫을 때 호출 (스토리 진행용)
  say: (speaker, lines, sound = 'talk', onClose = null) => {
    sfx.play(sound);
    set({ dialog: { speaker, lines, index: 0, onClose } });
  },
  // 지금 열려 있는 대화가 닫힐 때 할 일 추가
  onDialogClose: (fn) => {
    const d = get().dialog;
    if (!d) return fn();
    const prev = d.onClose;
    set({ dialog: { ...d, onClose: () => (prev?.(), fn()) } });
  },
  advanceDialog: () => {
    const d = get().dialog;
    if (!d) return;
    sfx.play('blip');
    if (d.index + 1 < d.lines.length) set({ dialog: { ...d, index: d.index + 1 } });
    else {
      set({ dialog: null });
      d.onClose?.();
    }
  },

  // ── 튜토리얼 ──
  setTutorial: (step) => set((s) => ({ progress: { ...s.progress, tutorial: step } })),
  // 단계 완료: "잘했어요!" 를 잠깐 보여 준 뒤 다음 단계로
  passTutorialStep: (from, next) => {
    if (get().progress.tutorial !== from || get().tutorialFlash) return;
    sfx.play('deliver');
    set({ tutorialFlash: { at: Date.now() } });
    setTimeout(() => {
      set({ tutorialFlash: null });
      if (get().progress.tutorial === from) get().setTutorial(next);
    }, 1300);
  },
  toast: (text) => {
    const id = Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, text }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2600);
  },
  setPrompt: (prompt) => get().prompt !== prompt && set({ prompt }),
  closeClear: () => set({ showClear: false }),
  // 🏆 내 기록: 클리어 화면(스피드런·학교 순위)을 다시 열기
  openRecord: () => set({ showClear: 'review', dialog: null }),
}));

function sortQuests(ids) {
  const order = [...MAIN_QUESTS, 'final', 'quiz'];
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
