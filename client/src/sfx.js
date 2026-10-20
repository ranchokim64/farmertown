// 효과음: 음원 파일 없이 Web Audio API 로 직접 합성합니다 (학교망에서도 추가 다운로드 없음).
// 브라우저 정책상 첫 클릭/키 입력 이후에만 소리가 납니다.

const MUTE_KEY = 'farmertown:muted';

let ctx = null;
let master = null;
let noiseBuf = null;
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();
const listeners = new Set();

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.55;
  const comp = ctx.createDynamicsCompressor(); // 여러 소리가 겹쳐도 귀가 아프지 않게
  master.connect(comp).connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

// 첫 사용자 입력에서 오디오 잠금 해제
const unlock = () => {
  ensure();
  if (ctx?.state === 'suspended') ctx.resume();
};
window.addEventListener('pointerdown', unlock, { passive: true });
window.addEventListener('keydown', unlock);

function tone(freq, { at = 0, dur = 0.15, type = 'sine', vol = 0.3, to, attack = 0.005 } = {}) {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise({ at = 0, dur = 0.3, vol = 0.2, filter = 'lowpass', freq = 1200, to, q = 1 } = {}) {
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(0.02, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

const C5 = 523.25;
const note = (semi) => C5 * 2 ** (semi / 12);

const SOUNDS = {
  // UI
  click: () => tone(880, { dur: 0.06, type: 'triangle', vol: 0.2 }),
  start: () => [0, 4, 7, 12].forEach((s, i) => tone(note(s), { at: i * 0.07, dur: 0.25, type: 'triangle', vol: 0.25 })),
  // 대화창 열기 (뽀옹), 넘기기 (톡)
  talk: () => {
    tone(420, { dur: 0.12, type: 'sine', vol: 0.25, to: 760 });
    tone(760, { at: 0.08, dur: 0.1, type: 'sine', vol: 0.15, to: 980 });
  },
  blip: () => tone(660 + Math.random() * 80, { dur: 0.05, type: 'square', vol: 0.06 }),
  // 아이템 줍기 (반짝)
  pickup: () => {
    tone(note(7), { dur: 0.12, type: 'triangle', vol: 0.25 });
    tone(note(12), { at: 0.07, dur: 0.18, type: 'triangle', vol: 0.25 });
    tone(note(19), { at: 0.14, dur: 0.25, type: 'sine', vol: 0.12 });
  },
  // 우렁이 방사 (퐁당)
  splash: () => {
    tone(900, { dur: 0.18, type: 'sine', vol: 0.3, to: 220 });
    noise({ at: 0.04, dur: 0.35, vol: 0.18, filter: 'bandpass', freq: 1800, to: 500, q: 2 });
  },
  // 배달/장착 (뿅)
  deliver: () => {
    tone(note(4), { dur: 0.1, type: 'triangle', vol: 0.25 });
    tone(note(9), { at: 0.08, dur: 0.22, type: 'triangle', vol: 0.25 });
  },
  // 아직 조건이 안 됨 (음~)
  hint: () => tone(330, { dur: 0.22, type: 'triangle', vol: 0.18, to: 260 }),
  // 퀘스트 완료 팡파레
  quest: () => {
    [0, 4, 7].forEach((s, i) => tone(note(s), { at: i * 0.1, dur: 0.18, type: 'square', vol: 0.09 }));
    [12, 16, 19].forEach((s) => tone(note(s), { at: 0.32, dur: 0.6, type: 'triangle', vol: 0.16 }));
    tone(note(0) / 2, { at: 0.32, dur: 0.6, type: 'sine', vol: 0.25 });
  },
  // 학교 점수 올라감 (띠링)
  coin: () => {
    tone(note(14), { dur: 0.08, type: 'square', vol: 0.08 });
    tone(note(19), { at: 0.07, dur: 0.3, type: 'square', vol: 0.08 });
  },
  // 최종 클리어
  clear: () => {
    const mel = [0, 4, 7, 12, 7, 12, 16, 19];
    mel.forEach((s, i) => tone(note(s), { at: i * 0.12, dur: 0.3, type: 'triangle', vol: 0.22 }));
    [0, 4, 7, 12].forEach((s) => tone(note(s) / 2, { at: 0.96, dur: 1.4, type: 'sine', vol: 0.12 }));
  },
  // 불꽃놀이: 슝~ 펑!
  firework: () => {
    tone(300 + Math.random() * 200, { dur: 0.5, type: 'sine', vol: 0.06, to: 1400 });
    noise({ at: 0.5, dur: 0.9, vol: 0.35, freq: 900 + Math.random() * 600, to: 120 });
    noise({ at: 0.55, dur: 0.6, vol: 0.08, filter: 'highpass', freq: 5000 });
  },
  // 인트로 바람 소리
  whoosh: () => noise({ dur: 2.2, vol: 0.22, filter: 'bandpass', freq: 300, to: 2400, q: 0.7 }),
  // 발소리 (광장 돌바닥 / 흙길)
  stepStone: () => noise({ dur: 0.06, vol: 0.12, filter: 'bandpass', freq: 2200 + Math.random() * 600, q: 3 }),
  stepGrass: () => noise({ dur: 0.08, vol: 0.1, filter: 'lowpass', freq: 700 + Math.random() * 200 }),
};

export const sfx = {
  play(name) {
    if (muted || !SOUNDS[name]) return;
    if (!ensure() || ctx.state !== 'running') return;
    try {
      SOUNDS[name]();
    } catch {
      /* 오디오 오류는 게임 진행에 영향 없음 */
    }
  },
  isMuted: () => muted,
  setMuted(v) {
    muted = v;
    try {
      localStorage.setItem(MUTE_KEY, v ? '1' : '0');
    } catch {
      /* 무시 */
    }
    if (master) master.gain.value = v ? 0 : 0.55;
    listeners.forEach((fn) => fn(v));
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
