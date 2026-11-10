import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store.js';
import { QUESTS, ITEMS, currentQuest } from '../game/data/quests.js';
import { joystick, fireInteract } from '../game/input.js';
import { SoundToggles } from './SoundToggles.jsx';
import { TutorialBanner } from './TutorialBanner.jsx';
import { richText } from './richText.jsx';
import { useLearnNote } from './LearnNote.jsx';

function QuestLog() {
  const progress = useGame((s) => s.progress);
  const tutorial = progress.tutorial ?? 'done';
  // 튜토리얼 연습 중에는 접어 두었다가, 촌장님이 미션 창을 설명할 때 펼치고 반짝임
  const [open, setOpen] = useState(tutorial === 'done');
  useEffect(() => {
    if (tutorial === 'mission' || tutorial === 'done') setOpen(true);
  }, [tutorial]);
  // 한 번이라도 클리어했으면(처음부터 다시 하는 중에도) 기록 다시 보기 버튼
  const hasRecord = useGame((s) => !!s.clearInfo?.timeMs || s.progress.completed.includes('final'));
  const doneCount = QUESTS.filter((q) => progress.completed.includes(q.id)).length;
  return (
    <div className={`panel quest-log ${tutorial === 'mission' ? 'spotlight' : ''}`}>
      <button className="panel-head" onClick={() => setOpen(!open)}>
        📜 축제 미션 <b>{doneCount}/6</b> <span className="muted">{open ? '▲' : '▼'}</span>
      </button>
      {tutorial === 'done' && (
        <div className="quest-tools">
          <button onClick={useLearnNote.getState().show}>📒 배움 노트</button>
          {hasRecord && (
            <button className="record-btn" onClick={useGame.getState().openRecord}>
              🏆 내 기록
            </button>
          )}
          <button className="ghost" onClick={confirmRestart}>
            ↺ 처음부터
          </button>
        </div>
      )}
      {open && (
        <ol>
          {QUESTS.map((q, n) => {
            // 미션은 차례대로: 끝난 것 ✅ / 지금 미션은 할 일 목록 / 나머지는 🔒
            const done = progress.completed.includes(q.id);
            const current = currentQuest(progress) === q.id;
            const locked = !done && !current;
            const steps = q.steps(progress);
            return (
              <li key={q.id} className={done ? 'done' : locked ? 'locked' : 'current'}>
                <div className="q-title">
                  {done ? '✅' : locked ? '🔒' : '👉'} {n + 1}. {q.title} <span className="muted">· {q.place}</span>
                </div>
                {current && (
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

function confirmRestart() {
  if (
    window.confirm(
      '처음부터 다시 할까요?\n\n진행 상황(미션·리본)만 처음으로 돌아가요.\n우리 학교 점수와 클리어 기록은 그대로예요. (다시 깨도 점수는 더해지지 않아요)',
    )
  )
    useGame.getState().restartProgress();
}

function SchoolPanel() {
  const profile = useGame((s) => s.profile);
  const lb = useGame((s) => s.leaderboard);
  const online = useGame((s) => s.online);
  const serverScore = useGame((s) => s.serverScore);
  const my = lb?.mySchool;
  return (
    <div className="panel school-panel">
      <SoundToggles />
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
      <p>{richText(dialog.lines[dialog.index])}</p>
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

const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export function HUD() {
  const tutorial = useGame((s) => s.progress.tutorial ?? 'done');
  // 조작법 요약: 튜토리얼을 건너뛴 경우에만 잠깐 보여 줌 (튜토리얼 중에는 안내 배너가 대신함)
  const [help, setHelp] = useState(tutorial === 'done');
  useEffect(() => {
    const t = setTimeout(() => setHelp(false), 12000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`hud ${tutorial !== 'done' ? 'tutoring' : ''} ${isTouch ? 'touch' : ''}`}>
      <QuestLog />
      <SchoolPanel />
      <TutorialBanner />
      <Toasts />
      <Prompt />
      <Inventory />
      <Dialog />
      {help && tutorial === 'done' && !isTouch && (
        <div className="help" onClick={() => setHelp(false)}>
          <kbd>W A S D</kbd>/<kbd>방향키</kbd> 이동 · <kbd>Shift</kbd> 달리기 · <kbd>E</kbd> 줍기·대화 · 마우스 드래그(또는 <kbd>Q</kbd>/<kbd>R</kbd>) 시점 회전 · <kbd>M</kbd> 효과음 · <kbd>B</kbd> 음악
          <br />
          발밑의 <b style={{ color: '#ffd34d' }}>노란 화살표</b>를 따라가 보세요!
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
