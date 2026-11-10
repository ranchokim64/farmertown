import { useEffect } from 'react';
import { create } from 'zustand';
import { useGame } from '../store.js';
import { LEARN } from '../game/data/story.js';
import { richText } from './richText.jsx';

// 📒 배움 노트: 끝낸 미션에서 배운 핵심 내용(= 활동지 정답)을 언제든 다시 보기
export const useLearnNote = create((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));

const ENTRIES = [
  { id: 'soil', no: '1', img: 'soil' },
  { id: 'snail', no: '2', img: 'snail' },
  { id: 'scarecrow', no: '3', img: 'scarecrow' },
  { id: 'tteok', no: '4', img: 'tteok' },
  { id: 'smartfarm', no: '5', img: 'smartfarm' },
  { id: 'final', no: '6', img: 'final' },
  { id: 'frog', no: '보너스', img: 'fields', bonus: true },
];

export function LearnNote() {
  const open = useLearnNote((s) => s.open);
  const hide = useLearnNote((s) => s.hide);
  const progress = useGame((s) => s.progress);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && hide();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, hide]);

  if (!open) return null;
  const done = (e) => (e.bonus ? !!progress.flags.met_frog : progress.completed.includes(e.id));
  const count = ENTRIES.filter((e) => !e.bonus && done(e)).length;
  return (
    <div className="note-bg" onClick={hide}>
      <div className="note-card" onClick={(e) => e.stopPropagation()}>
        <div className="note-head">
          <h2>📒 배움 노트</h2>
          <span className="muted">끝낸 미션 {count}/6</span>
          <button className="note-x" aria-label="닫기" onClick={hide}>
            ✕
          </button>
        </div>
        <p className="note-tip">미션에서 들은 중요한 이야기가 여기에 적혀요. 활동지를 채울 때 확인해 보세요!</p>
        <ol className="note-list">
          {ENTRIES.map((e) => {
            const L = LEARN[e.id];
            const ok = done(e);
            return (
              <li key={e.id} className={ok ? 'open' : 'locked'}>
                <img src={`${import.meta.env.BASE_URL}learn/${e.img}.jpg`} alt="" />
                <div>
                  <h3>
                    <span className={`no ${e.bonus ? 'bonus' : ''}`}>{e.bonus ? e.no : `미션 ${e.no}`}</span> {L.title}
                  </h3>
                  {ok ? (
                    <>
                      <ul>
                        {L.lines.map((line, i) => (
                          <li key={i}>{richText(line)}</li>
                        ))}
                      </ul>
                      <p className="again">🔁 다시 듣고 싶으면 <b>{L.who}</b>에게 가서 말을 걸어 보세요.</p>
                    </>
                  ) : (
                    <p className="lockmsg">🔒 {e.bonus ? '들판의 개구리 개굴이를 찾아 말을 걸면 적혀요' : '미션을 끝내면 여기에 적혀요'}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <button className="btn primary" onClick={hide}>
          닫기
        </button>
      </div>
    </div>
  );
}
