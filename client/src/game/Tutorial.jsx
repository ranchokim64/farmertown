import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGame } from '../store.js';
import { player, cam } from './runtime.js';
import { CHIEF_NAME, greetLines, missionLines } from './data/story.js';
import { PLACES } from './data/world.js';
import { Villager } from './models/Characters.jsx';
import { QuestMark } from './models/Workplaces.jsx';

const MOVE_GOAL = 6; // m 만큼 걸으면 통과
const LOOK_GOAL = 1.4; // 라디안(약 80°) 만큼 둘러보면 통과

// 걷기/둘러보기 진행도 (0~1). 안내 배너의 진행 막대가 읽음 (매 프레임 바뀌므로 React 상태 대신 가변 객체)
export const tutorialMeter = { value: 0 };

export function finishTutorial() {
  const s = useGame.getState();
  s.setTutorial('done');
  s.toast('🎉 튜토리얼 완료! 이제 마을 친구들을 도와주러 가 볼까요?');
}

// 튜토리얼 진행: 단계마다 조건을 확인하고 "잘했어요!" → 다음 단계
export function TutorialSystem() {
  const greeted = useRef(false);
  const missionTold = useRef(false);
  const last = useRef({ x: 0, z: 0, yaw: 0, step: null });
  const acc = useRef(0);
  const wait = useRef(0);

  useFrame((_, dt) => {
    const s = useGame.getState();
    const step = s.progress.tutorial ?? 'done';
    if (s.phase !== 'play' || step === 'done') return;

    // 단계가 바뀌면 측정 초기화
    if (last.current.step !== step) {
      last.current = { x: player.pos.x, z: player.pos.z, yaw: cam.yaw, step };
      acc.current = 0;
      wait.current = 0;
      tutorialMeter.value = 0;
    }
    if (s.dialog || s.tutorialFlash) return;

    switch (step) {
      case 'greet':
        // 인트로가 끝나고 잠깐 뒤 촌장님이 먼저 말을 검
        wait.current += dt;
        if (!greeted.current && wait.current > 0.7) {
          greeted.current = true;
          s.say(CHIEF_NAME, greetLines(s.profile?.nickname ?? '친구'), 'talk', () => s.setTutorial('move'));
        }
        break;
      case 'move':
        acc.current += Math.hypot(player.pos.x - last.current.x, player.pos.z - last.current.z);
        last.current.x = player.pos.x;
        last.current.z = player.pos.z;
        tutorialMeter.value = Math.min(1, acc.current / MOVE_GOAL);
        if (acc.current >= MOVE_GOAL) s.passTutorialStep('move', 'look');
        break;
      case 'look': {
        let d = cam.yaw - last.current.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        acc.current += Math.abs(d);
        last.current.yaw = cam.yaw;
        tutorialMeter.value = Math.min(1, acc.current / LOOK_GOAL);
        if (acc.current >= LOOK_GOAL) s.passTutorialStep('look', 'talk');
        break;
      }
      case 'pickup':
        // 앞 단계에서 미리 주웠어도 통과
        if (Object.keys(s.progress.flags).some((f) => f.startsWith('hanja_'))) s.passTutorialStep('pickup', 'mission');
        break;
      case 'mission':
        if (!missionTold.current) {
          missionTold.current = true;
          s.say(CHIEF_NAME, missionLines, 'talk', finishTutorial);
        }
        break;
      default:
    }
  });
  return null;
}


// 촌장님: 분수대 앞에 서서 플레이어 쪽을 바라봄. 튜토리얼 첫 인사 때는 손을 흔듦
export function Chief() {
  const step = useGame((s) => s.progress.tutorial ?? 'done');
  const [x, , z] = PLACES.chief;
  const face = Math.atan2(0 - x, 8 - z); // 시작 위치의 플레이어를 바라보기
  return (
    <group position={PLACES.chief} rotation={[0, face, 0]}>
      <Villager overall="#3b4a6b" shirt="#f8f4ea" hat="gat" hair="#eeeeee" beard cane wave={step === 'greet'} />
      {step === 'done' && <QuestMark position={[0, 3.4, 0]} text="?" color="#9fdcff" />}
    </group>
  );
}
