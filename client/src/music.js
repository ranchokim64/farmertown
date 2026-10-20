// 배경음악: 음원 파일 없이 Web Audio API 로 악보를 실시간 연주합니다.
// - 6/8 박자(세마치 장단 느낌) + 5음 음계(도레미솔라) 로 포근한 시골 마을 분위기
// - title(타이틀/인트로), village(마을), festival(클리어 후 축제) 세 곡
import { audioBus } from './sfx.js';

const MUTE_KEY = 'farmertown:musicMuted';
const VOLUME = 0.3;

// ── 악보 ────────────────────────────────────────────
// 한 마디 = 8분음표 6칸. 음이름(C5), '-' 앞 음 늘이기, '.' 쉼표
const VILLAGE_BARS = [
  ['C', 'E5 - G5 A5 - G5'],
  ['Am', 'E5 - D5 C5 - -'],
  ['F', 'A4 - C5 D5 - E5'],
  ['G', 'D5 - - . G4 .'],
  ['C', 'E5 - G5 A5 - C6'],
  ['Am', 'A5 - G5 E5 - G5'],
  ['Dm', 'D5 - E5 G5 - E5'],
  ['G', 'D5 - E5 C5 - .'],
  ['F', 'C6 - A5 G5 - A5'],
  ['C', 'G5 - E5 D5 - E5'],
  ['F', 'A5 - G5 E5 - D5'],
  ['G', 'E5 - - D5 - .'],
  ['Am', 'C5 - E5 A5 - G5'],
  ['Em', 'G5 - E5 D5 - C5'],
  ['Dm', 'D5 - E5 G5 - A5'],
  ['G', 'G5 - - - . .'],
];

const TITLE_BARS = [
  ['C', 'G5 - - E5 - -'],
  ['Am', 'A5 - - - - -'],
  ['F', 'C6 - - A5 - G5'],
  ['G', 'G5 - - - - -'],
  ['C', 'E5 - - G5 - -'],
  ['Am', 'A5 - - G5 - E5'],
  ['Dm', 'D5 - - E5 - -'],
  ['C', 'C5 - - - - -'],
];

const SONGS = {
  title: { bars: TITLE_BARS, step: 0.3, drums: false, pad: true, lead: 0.12 },
  village: { bars: VILLAGE_BARS, step: 0.2, drums: true, pad: false, lead: 0.13 },
  festival: { bars: VILLAGE_BARS, step: 0.16, drums: true, pad: false, lead: 0.14, extraDrums: true },
};

const CHORDS = {
  C: ['C3', 'E3', 'G3'],
  Am: ['A2', 'C3', 'E3'],
  F: ['F2', 'A2', 'C3'],
  G: ['G2', 'B2', 'D3'],
  Dm: ['D3', 'F3', 'A3'],
  Em: ['E3', 'G3', 'B3'],
};

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const freqOf = (name) => 440 * 2 ** ((SEMI[name[0]] + 12 * (Number(name.slice(1)) + 1) - 69) / 12);

// 악보 → 칸별 연주 목록으로 미리 변환
function compile(song) {
  const steps = [];
  song.bars.forEach(([chord, mel]) => {
    const tokens = mel.trim().split(/\s+/);
    tokens.forEach((tok, i) => {
      let len = 0;
      if (tok !== '-' && tok !== '.') {
        len = 1;
        while (tokens[i + len] === '-') len++;
      }
      steps.push({ note: len ? tok : null, len, chord, beat: i });
    });
  });
  return steps;
}
for (const s of Object.values(SONGS)) s.steps = compile(s);

// ── 악기 ────────────────────────────────────────────
function voice(a, out, { type, freq, t, dur, vol, attack = 0.01, release = 0.2, to, detune = 0 }) {
  const osc = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.setTargetAtTime(0, t + Math.max(attack, dur - release), release / 3);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + release + 0.1);
  return osc;
}

// 피리/단소 느낌의 주선율 (부드러운 시작 + 살짝 떨림)
function flute(a, out, freq, t, dur, vol) {
  const o1 = voice(a, out, { type: 'triangle', freq, t, dur, vol, attack: 0.04, release: 0.12 });
  voice(a, out, { type: 'sine', freq: freq * 2, t, dur, vol: vol * 0.25, attack: 0.05, release: 0.1 });
  if (dur > 0.35) {
    const lfo = a.ctx.createOscillator();
    const depth = a.ctx.createGain();
    lfo.frequency.value = 5;
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(freq * 0.006, t + 0.3);
    lfo.connect(depth).connect(o1.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.2);
  }
}

// 가야금 느낌의 뜯는 소리
function pluck(a, out, freq, t, vol) {
  voice(a, out, { type: 'triangle', freq: freq * 1.004, to: freq, t, dur: 0.5, vol, attack: 0.003, release: 0.45 });
}

function noiseHit(a, out, t, vol, freq) {
  const src = a.ctx.createBufferSource();
  src.buffer = a.noise;
  const f = a.ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = freq;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + 0.08);
}

// 장구 느낌: 덩(낮은 북) / 쿵 / 덕(채 소리)
const drum = {
  deong: (a, out, t, v) => voice(a, out, { type: 'sine', freq: 150, to: 55, t, dur: 0.28, vol: 0.5 * v, attack: 0.003, release: 0.25 }),
  kung: (a, out, t, v) => voice(a, out, { type: 'sine', freq: 210, to: 95, t, dur: 0.16, vol: 0.28 * v, attack: 0.003, release: 0.14 }),
  deok: (a, out, t, v) => noiseHit(a, out, t, 0.09 * v, 3500),
};

function playStep(a, out, song, s, t) {
  const chord = CHORDS[s.chord].map(freqOf);
  if (s.note) {
    flute(a, out, freqOf(s.note), t, s.len * song.step, song.lead);
  }
  if (song.pad) {
    // 은은하게 깔리는 화음 (마디 첫 박에만)
    if (s.beat === 0) chord.forEach((f) => voice(a, out, { type: 'sine', freq: f * 2, t, dur: song.step * 6, vol: 0.045, attack: 0.6, release: 0.8 }));
    if (s.beat === 0 || s.beat === 3) pluck(a, out, chord[s.beat === 0 ? 0 : 2] * 2, t, 0.05);
    return;
  }
  // 베이스: 첫 박 근음, 넷째 칸 5도
  if (s.beat === 0) voice(a, out, { type: 'sine', freq: chord[0], t, dur: song.step * 2.5, vol: 0.22, attack: 0.01, release: 0.2 });
  if (s.beat === 3) voice(a, out, { type: 'sine', freq: chord[2] / 2, t, dur: song.step * 2.5, vol: 0.16, attack: 0.01, release: 0.2 });
  // 가야금 반주
  if (s.beat !== 0 && s.beat !== 3) pluck(a, out, chord[(s.beat * 2) % 3] * 2, t, 0.06);
  if (song.drums) {
    const v = song.extraDrums ? 1.15 : 1;
    if (s.beat === 0) drum.deong(a, out, t, v);
    if (s.beat === 3) drum.kung(a, out, t, v);
    if (s.beat === 2 || s.beat === 5) drum.deok(a, out, t, v);
    if (song.extraDrums && (s.beat === 1 || s.beat === 4)) drum.deok(a, out, t, 0.6);
  }
}

// ── 재생 엔진 (앞질러 예약하는 스케줄러) ────────────
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();
const listeners = new Set();
let gain = null;
let current = null; // 지금 연주 중인 곡 이름
let wanted = null; // 연주해야 할 곡 이름
let stepIdx = 0;
let nextTime = 0;
let switchAt = 0; // 곡 전환(페이드아웃) 끝나는 시각

function level() {
  return muted ? 0 : VOLUME;
}

function tick() {
  if (!wanted || muted) return; // 꺼져 있으면 연주 예약 자체를 하지 않음 (저사양 기기 배려)
  const a = audioBus();
  if (!a || a.ctx.state !== 'running') return;
  const now = a.ctx.currentTime;
  if (!gain) {
    gain = a.ctx.createGain();
    gain.gain.value = 0;
    gain.connect(a.out);
  }
  // 탭이 숨겨졌다 돌아오면 밀린 음을 한꺼번에 연주하지 않도록
  if (nextTime < now - 0.5) nextTime = now + 0.05;

  if (wanted !== current && !switchAt) {
    if (current) {
      // 0.8초 페이드아웃 후 새 곡 시작
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.8);
      switchAt = now + 0.85;
    } else {
      switchAt = now;
    }
  }
  if (switchAt && now >= switchAt) {
    current = wanted;
    switchAt = 0;
    stepIdx = 0;
    nextTime = now + 0.1;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level(), now + 1.5);
  }
  if (!current || switchAt) return;

  const song = SONGS[current];
  while (nextTime < now + 0.25) {
    playStep(a, gain, song, song.steps[stepIdx], nextTime);
    nextTime += song.step;
    stepIdx = (stepIdx + 1) % song.steps.length;
  }
}

setInterval(tick, 50);

export const music = {
  // 'title' | 'village' | 'festival'
  play(name) {
    wanted = name;
    tick();
  },
  // 클리어 팡파레 등이 잘 들리도록 잠깐 줄임
  duck(seconds = 3) {
    const a = audioBus();
    if (!gain || !a || muted) return;
    const now = a.ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(VOLUME * 0.25, now + 0.15);
    gain.gain.setValueAtTime(VOLUME * 0.25, now + seconds);
    gain.gain.linearRampToValueAtTime(VOLUME, now + seconds + 1.5);
  },
  isMuted: () => muted,
  setMuted(v) {
    muted = v;
    try {
      localStorage.setItem(MUTE_KEY, v ? '1' : '0');
    } catch {
      /* 무시 */
    }
    const a = audioBus();
    if (gain && a) {
      const now = a.ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(level(), now + 0.3);
    }
    listeners.forEach((fn) => fn(v));
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
