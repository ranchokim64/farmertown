import { useEffect, useState } from 'react';
import { useGame } from '../store.js';
import { STEP_GUIDE, TUTORIAL_STEPS } from '../game/data/story.js';
import { tutorialMeter, finishTutorial } from '../game/Tutorial.jsx';

const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
const PRACTICE = ['move', 'look', 'talk', 'pickup']; // 배너로 안내하는 연습 단계

// 화면 위쪽 가운데의 튜토리얼 안내 배너
export function TutorialBanner() {
  const step = useGame((s) => s.progress.tutorial ?? 'done');
  const flash = useGame((s) => s.tutorialFlash);
  const dialog = useGame((s) => s.dialog);
  const [meter, setMeter] = useState(0);

  // 걷기/둘러보기 진행 막대 (매 프레임 바뀌는 값을 0.1초마다 읽음)
  useEffect(() => {
    if (step !== 'move' && step !== 'look') return undefined;
    const id = setInterval(() => setMeter(tutorialMeter.value), 100);
    return () => clearInterval(id);
  }, [step]);

  const guide = STEP_GUIDE[step];
  if (!guide || (dialog && !flash)) return null;
  const n = PRACTICE.indexOf(step) + 1;

  return (
    <div className={`tutorial-banner ${flash ? 'passed' : ''}`} role="status">
      <div className="tb-head">
        <span className="tb-step">
          연습 {n}/{PRACTICE.length}
        </span>
        <button className="tb-skip" onClick={skipTutorial}>
          건너뛰기 ⏭
        </button>
      </div>
      {flash ? (
        <div className="tb-body">
          <span className="tb-icon">🌟</span>
          <b>잘했어요!</b>
        </div>
      ) : (
        <div className="tb-body">
          <span className="tb-icon">{guide.icon}</span>
          <div>
            <b>{guide.title}</b>
            <p>{isTouch ? guide.touch : guide.text}</p>
          </div>
        </div>
      )}
      {(step === 'move' || step === 'look') && !flash && (
        <div className="tb-meter">
          <div style={{ width: `${Math.round(meter * 100)}%` }} />
        </div>
      )}
      <div className="tb-dots">
        {PRACTICE.map((s) => (
          <i key={s} className={TUTORIAL_STEPS.indexOf(s) < TUTORIAL_STEPS.indexOf(step) || (s === step && flash) ? 'on' : s === step ? 'now' : ''} />
        ))}
      </div>
    </div>
  );
}

function skipTutorial() {
  if (window.confirm('튜토리얼을 건너뛸까요? (분수대 앞 촌장님께 말을 걸면 언제든 도움말을 들을 수 있어요)')) {
    useGame.setState({ dialog: null, tutorialFlash: null });
    finishTutorial();
  }
}
