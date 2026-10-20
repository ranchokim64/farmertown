import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store.js';
import { QUESTS, ITEMS } from '../game/data/quests.js';
import { joystick, fireInteract } from '../game/input.js';
import { sfx } from '../sfx.js';

function QuestLog() {
  const progress = useGame((s) => s.progress);
  const [open, setOpen] = useState(true);
  const doneCount = QUESTS.filter((q) => progress.completed.includes(q.id)).length;
  return (
    <div className="panel quest-log">
      <button className="panel-head" onClick={() => setOpen(!open)}>
        📜 축제 미션 <b>{doneCount}/6</b> <span className="muted">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ol>
          {QUESTS.map((q) => {
            const done = progress.completed.includes(q.id);
            const steps = q.steps(progress);
            const locked = q.id === 'final' && !steps[0].done;
            return (
              <li key={q.id} className={done ? 'done' : locked ? 'locked' : ''}>
                <div className="q-title">
                  {done ? '✅' : '⬜'} {q.title} <span className="muted">· {q.place}</span>
                </div>
                {!done && (
                  <ul>
                    {steps.map((st, i) => (
                      <li key={i} className={st.done ? 'done' : ''}>
                        {st.done ? '✔' : '•'} {st.text}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function SchoolPanel() {
  const profile = useGame((s) => s.profile);
  const lb = useGame((s) => s.leaderboard);
  const online = useGame((s) => s.online);
  const serverScore = useGame((s) => s.serverScore);
  const my = lb?.mySchool;
  return (
    <div className="panel school-panel">
      <MuteButton />
      <div className="nick">
        👩‍🌾 {profile?.nickname} <span className={`dot ${online ? 'on' : 'off'}`} title={online ? '서버 연결됨' : '오프라인 (진행은 저장돼요)'} />
      </div>
      <div className="school">🏫 {profile?.school?.name}</div>
      <div className="score">
        우리 학교 <b>{my ? my.score.toLocaleString() : '-'}점</b>
        {my?.rank && <span className="rank"> · {my.rank}위</span>}
      </div>
      <div className="muted small">내가 모은 점수 {serverScore ?? 0}점</div>
      {!online && <div className="offline">오프라인 모드 · 연결되면 점수가 자동으로 전송돼요</div>}
    </div>
  );
}

function Inventory() {
  const inv = useGame((s) => s.progress.inventory);
  if (!inv.length) return null;
  return (
    <div className="inventory">
      {inv.map((id, i) => (
        <div key={`${id}${i}`} className="slot" title={ITEMS[id]?.name}>
          <span className="icon">{ITEMS[id]?.icon}</span>
          <span className="name">{ITEMS[id]?.name}</span>
        </div>
      ))}
    </div>
  );
}

function Dialog() {
  const dialog = useGame((s) => s.dialog);
  const advance = useGame((s) => s.advanceDialog);
  if (!dialog) return null;
  const last = dialog.index === dialog.lines.length - 1;
  return (
    <div className="dialog" onClick={advance}>
      <div className="speaker">{dialog.speaker}</div>
      <p>{dialog.lines[dialog.index]}</p>
      <div className="next">{last ? '닫기' : '다음'} ▶ <span className="muted">(E / 스페이스 / 터치)</span></div>
    </div>
  );
}

function Prompt() {
  const prompt = useGame((s) => s.prompt);
  const dialog = useGame((s) => s.dialog);
  if (!prompt || dialog) return null;
  return (
    <div className="prompt" onClick={fireInteract}>
      <kbd>E</kbd> {prompt}
    </div>
  );
}

function Toasts() {
  const toasts = useGame((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.text}
        </div>
      ))}
    </div>
  );
}

function Joystick() {
  const base = useRef();
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pointer = useRef(null);
  useEffect(
    () => () => {
      joystick.x = 0;
      joystick.y = 0;
    },
    [],
  );
  const update = (e) => {
    const r = base.current.getBoundingClientRect();
    const max = r.width / 2;
    let x = e.clientX - (r.left + max);
    let y = e.clientY - (r.top + max);
    const d = Math.hypot(x, y);
    if (d > max) {
      x = (x / d) * max;
      y = (y / d) * max;
    }
    joystick.x = x / max;
    joystick.y = y / max;
    setKnob({ x, y });
  };
  const end = () => {
    pointer.current = null;
    joystick.x = 0;
    joystick.y = 0;
    setKnob({ x: 0, y: 0 });
  };
  return (
    <div
      ref={base}
      className="joystick"
      onPointerDown={(e) => {
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => pointer.current === e.pointerId && update(e)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

function MuteButton() {
  const [muted, setMuted] = useState(sfx.isMuted());
  useEffect(() => {
    const off = sfx.subscribe(setMuted);
    const onKey = (e) => e.code === 'KeyM' && !e.repeat && sfx.setMuted(!sfx.isMuted());
    window.addEventListener('keydown', onKey);
    return () => {
      off();
      window.removeEventListener('keydown', onKey);
    };
  }, []);
  return (
    <button className="mute-btn" title="효과음 켜기/끄기 (M)" aria-label="효과음 켜기/끄기" onClick={() => sfx.setMuted(!muted)}>
      {muted ? '🔇' : '🔊'}
    </button>
  );
}

const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export function HUD() {
  const [help, setHelp] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setHelp(false), 12000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="hud">
      <QuestLog />
      <SchoolPanel />
      <Toasts />
      <Prompt />
      <Inventory />
      <Dialog />
      {help && !isTouch && (
        <div className="help" onClick={() => setHelp(false)}>
          <kbd>W A S D</kbd>/<kbd>방향키</kbd> 이동 · <kbd>Shift</kbd> 달리기 · <kbd>E</kbd> 줍기·대화 · 마우스 드래그(또는 <kbd>Q</kbd>/<kbd>R</kbd>) 시점 회전 · <kbd>M</kbd> 소리
          <br />
          머리 위 <b style={{ color: '#ffd34d' }}>노란 화살표</b>를 따라가 보세요!
        </div>
      )}
      {isTouch && (
        <>
          <Joystick />
          <button className="touch-e" onPointerDown={fireInteract}>
            E
          </button>
        </>
      )}
    </div>
  );
}
