import { useState } from 'react';
import { useGame } from '../store.js';
import { QUIZ, LEARN } from '../game/data/story.js';
import { MAIN_QUESTS } from '../game/data/quests.js';
import { sfx } from '../sfx.js';
import { richText } from './richText.jsx';
import { useLearnNote } from './LearnNote.jsx';

// 미션 끝 OX 퀴즈 / 최종 보너스 퀴즈 모달
export function Quiz() {
  const quiz = useGame((s) => s.quiz);
  if (!quiz) return null;
  return quiz.kind === 'ox' ? <OxQuiz key={`ox-${quiz.q}`} quiz={quiz} /> : <FinalQuiz key="final" />;
}

// OX: 틀리면 해설을 보고 다시 풀어야 리본 (닫기 없음)
function OxQuiz({ quiz }) {
  const item = QUIZ.ox[quiz.q];
  const [picked, setPicked] = useState(null); // true | false | null
  const correct = picked !== null && picked === item.answer;
  const ribbonNo = useGame((s) => MAIN_QUESTS.filter((q) => s.progress.completed.includes(q)).length) + 1;

  const choose = (v) => {
    if (picked !== null) return;
    setPicked(v);
    sfx.play(v === item.answer ? 'correct' : 'wrong');
  };
  const pass = () => {
    useGame.getState().closeQuiz();
    quiz.onPass?.();
  };

  return (
    <div className="modal-bg quiz-bg">
      <div className="modal quiz">
        <div className="quiz-tag">📝 확인 퀴즈 · {LEARN[quiz.q]?.title ?? ''}</div>
        <p className="quiz-q">{richText(item.text)}</p>
        <div className="ox-row">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              className={`ox-btn ${v ? 'o' : 'x'} ${picked === v ? (correct ? 'right' : 'wrong') : ''}`}
              onClick={() => choose(v)}
              disabled={picked !== null && picked !== v}
              aria-label={v ? '맞아요 (O)' : '틀려요 (X)'}
            >
              {v ? '⭕' : '❌'}
            </button>
          ))}
        </div>
        {picked !== null && (
          <div className={`quiz-result ${correct ? 'right' : 'wrong'}`}>
            <b>{correct ? '🎉 정답이에요!' : '앗, 아쉬워요!'}</b>
            <p>{richText(item.explain)}</p>
            {correct ? (
              <button className="btn primary big" onClick={pass}>
                🎀 {ribbonNo}번째 감사 리본 받기! (+10점)
              </button>
            ) : (
              <>
                <p className="muted">해설을 잘 읽고 다시 풀어 봐요. 📒 배움 노트에도 적혀 있어요.</p>
                <button className="btn primary big" onClick={() => setPicked(null)}>
                  ↺ 다시 풀기
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 최종 보너스 퀴즈: 5문제 3지선다, 모두 맞히면 학교 +20 (한 사람 1번)
function FinalQuiz() {
  const total = QUIZ.final.length;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState([]);
  const passedBefore = useGame((s) => !!s.progress.flags.quiz_passed);
  const close = () => useGame.getState().closeQuiz();

  if (step >= total) {
    const wrong = QUIZ.final.map((q, i) => ({ ...q, i, picked: answers[i] })).filter((q) => q.picked !== q.answer);
    const score = total - wrong.length;
    return (
      <div className="modal-bg quiz-bg">
        <div className="modal quiz">
          <div className="quiz-tag">🏆 보너스 퀴즈 결과</div>
          <h2>
            {score} / {total}
          </h2>
          {wrong.length === 0 ? (
            <div className="quiz-result right">
              <b>🎉 모두 맞혔어요! 진짜 농업 박사예요!</b>
              <p>{passedBefore ? '보너스 점수는 처음 맞혔을 때 이미 받았어요.' : '우리 학교에 보너스 +20점을 보내요!'}</p>
              <button className="btn primary big" onClick={close}>
                좋아요!
              </button>
            </div>
          ) : (
            <div className="quiz-result wrong">
              <b>조금만 더! 틀린 문제를 다시 확인해 봐요.</b>
              <ul className="quiz-wrong">
                {wrong.map((q) => (
                  <li key={q.i}>
                    <span className="n">{q.i + 1}번</span> {richText(q.text)}
                    <br />
                    정답: <b className="key">{q.options[q.answer]}</b> — {richText(q.explain)}
                  </li>
                ))}
              </ul>
              <div className="clear-actions">
                <button className="btn ghost-strong" onClick={() => { close(); useLearnNote.getState().show(); }}>
                  📒 배움 노트 보기
                </button>
                <button className="btn primary" onClick={() => { setAnswers([]); setStep(0); }}>
                  ↺ 다시 도전
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const q = QUIZ.final[step];
  const choose = (i) => {
    sfx.play('blip');
    const next = [...answers, i];
    setAnswers(next);
    setStep(step + 1);
    if (next.length === total) {
      const allRight = QUIZ.final.every((qq, k) => next[k] === qq.answer);
      sfx.play(allRight ? 'clear' : 'hint');
      if (allRight) useGame.getState().passFinalQuiz();
    }
  };

  return (
    <div className="modal-bg quiz-bg">
      <div className="modal quiz">
        <button className="note-x quiz-x" onClick={close} aria-label="닫기">
          ✕
        </button>
        <div className="quiz-tag">
          🏆 보너스 퀴즈 · {step + 1} / {total}
        </div>
        <div className="quiz-dots">
          {QUIZ.final.map((_, i) => (
            <span key={i} className={i < step ? 'done' : i === step ? 'now' : ''} />
          ))}
        </div>
        <p className="quiz-q">{richText(q.text)}</p>
        <div className="choice-list">
          {q.options.map((o, i) => (
            <button key={`${step}-${i}`} className="choice-btn" onClick={() => choose(i)}>
              <span className="num">{i + 1}</span> {o}
            </button>
          ))}
        </div>
        {step === 0 && <p className="muted">5문제를 모두 맞히면 우리 학교 점수 +20점! (한 사람 한 번)</p>}
      </div>
    </div>
  );
}
