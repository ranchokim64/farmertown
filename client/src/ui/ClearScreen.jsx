import { useEffect } from 'react';
import { useGame } from '../store.js';
import { useLearnNote } from './LearnNote.jsx';

export function formatTime(ms) {
  if (ms == null) return '-';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}분 ${String(s % 60).padStart(2, '0')}초`;
}

export function ClearScreen() {
  const { clearInfo, leaderboard, profile, closeClear, refreshLeaderboard } = useGame();
  const replay = useGame((s) => (s.progress.replays ?? 0) > 0);
  const quizPassed = useGame((s) => !!s.progress.flags.quiz_passed);
  useEffect(() => {
    refreshLeaderboard();
  }, [refreshLeaderboard]);

  return (
    <div className="modal-bg">
      <div className="modal clear">
        <div className="badge">🎆 게임 클리어 🎆</div>
        <h2>황금 들판 감사 트리 완성!</h2>
        <p>
          <b>{profile?.nickname}</b> 농부님, 수고했어요! <br />
          {replay ? '다시 하기도 완료! (학교 점수는 처음 깼을 때 이미 더해졌어요)' : (
            <>
              우리 학교에 <b>+100점</b>을 보탰어요.
            </>
          )}
        </p>
        <div className="record">
          ⏱ 클리어 기록 <b>{formatTime(clearInfo?.timeMs)}</b>
          {clearInfo?.speedRank && <span> · 명예의 전당 {clearInfo.speedRank}위</span>}
        </div>

        <div className="boards">
          <div>
            <h3>🏆 명예의 전당 (스피드런)</h3>
            <ol className="rank-list">
              {(leaderboard?.speedrun ?? []).map((r) => (
                <li key={r.rank} className={r.nickname === profile?.nickname && r.schoolName === profile?.school?.name ? 'me' : ''}>
                  <span className="r">{r.rank}</span>
                  <span className="n">
                    {r.nickname} <small>{r.schoolName}</small>
                  </span>
                  <span className="v">{formatTime(r.timeMs)}</span>
                </li>
              ))}
              {!leaderboard?.speedrun?.length && <li className="muted">서버에 연결되면 순위가 표시돼요</li>}
            </ol>
          </div>
          <div>
            <h3>🏫 학교 대항전 TOP 5</h3>
            <ol className="rank-list">
              {(leaderboard?.schools ?? []).map((s) => (
                <li key={s.code} className={s.code === profile?.school?.code ? 'me' : ''}>
                  <span className="r">{s.rank}</span>
                  <span className="n">{s.name}</span>
                  <span className="v">{s.score.toLocaleString()}점</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <p className="muted">농업인 여러분, 맛있는 쌀을 길러 주셔서 고맙습니다! 🍚</p>
        {!quizPassed && (
          <button className="btn primary big quiz-cta" onClick={() => { closeClear(); useGame.getState().openQuiz({ kind: 'final' }); }}>
            🏆 보너스 퀴즈 도전! (5문제 모두 맞히면 +20점)
          </button>
        )}
        <div className="clear-actions">
          <button className="btn ghost-strong" onClick={() => { closeClear(); useLearnNote.getState().show(); }}>
            📒 배움 노트 보기
          </button>
          <button className="btn primary" onClick={closeClear}>
            마을 계속 둘러보기
          </button>
        </div>
      </div>
    </div>
  );
}
