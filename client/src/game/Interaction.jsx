import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../store.js';
import { INTERACTABLES } from './data/quests.js';
import { player } from './runtime.js';
import { onInteract } from './input.js';
import { mat } from './materials.js';
import { sfx } from '../sfx.js';
import { finishTutorial } from './Tutorial.jsx';

function nearest(p, filter, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const it of INTERACTABLES) {
    if (!filter(it)) continue;
    const d = Math.hypot(player.pos.x - it.pos[0], player.pos.z - it.pos[2]);
    const limit = maxDist === Infinity ? Infinity : it.radius;
    if (d < limit && d < bestD) {
      best = it;
      bestD = d;
    }
  }
  return best ? { it: best, d: bestD } : null;
}

export function interactNow() {
  const s = useGame.getState();
  if (s.phase !== 'play') return;
  if (s.dialog) return s.advanceDialog();
  // 프레임마다 캐시한 대상은 이미 처리됐을 수 있으므로 누르는 순간 다시 계산
  const current = nearest(s.progress, (it) => it.active(s.progress), 99)?.it;
  if (!current) return;
  current.interact({
    p: s.progress,
    nickname: s.profile?.nickname ?? '친구',
    setTutorial: s.setTutorial,
    finishTutorial,
    pick: s.pick,
    take: s.take,
    setFlag: s.setFlag,
    complete: s.complete,
    say: s.say,
    hint: (speaker, lines) => s.say(speaker, lines, 'hint'),
    sfx: sfx.play,
    toast: s.toast,
  });
  // 튜토리얼 '말 걸기' 단계: 참새와의 대화를 끝까지 읽으면 통과
  if (s.progress.tutorial === 'talk' && current.id === 'sparrowGuide') {
    useGame.getState().onDialogClose(() => useGame.getState().passTutorialStep('talk', 'pickup'));
  }
}

// 가까운 상호작용 대상을 찾아 [E] 안내를 띄우고, 길안내 화살표를 갱신합니다.
export function InteractionSystem() {
  const acc = useRef(0);
  const arrow = useRef();
  const guideTarget = useRef(null);
  useEffect(() => onInteract(interactNow), []);

  useFrame((state, dt) => {
    acc.current += dt;
    const s = useGame.getState();
    if (acc.current > 0.1) {
      acc.current = 0;
      const p = s.progress;
      const near = s.phase === 'play' ? nearest(p, (it) => it.active(p), 99) : null;
      s.setPrompt(near && !s.dialog ? near.it.label(p) : null);
      const step = p.tutorial ?? 'done';
      const guideFilter =
        step === 'done' ? (it) => it.guide(p)
        : step === 'talk' ? (it) => it.id === 'sparrowGuide'
        : step === 'pickup' ? (it) => it.id.startsWith('hanja_') && it.active(p)
        : () => false; // 첫 인사/걷기/둘러보기/미션 설명 중에는 화살표 숨김
      guideTarget.current = nearest(p, guideFilter, Infinity);
    }
    // 길안내 화살표
    const g = guideTarget.current;
    const a = arrow.current;
    if (!a) return;
    a.visible = s.phase === 'play' && !!g && g.d > 4;
    if (a.visible) {
      // 발밑 바닥에 눕힌 화살표: 위에서 내려다보는 카메라에서 잘 보이고, 목표 쪽으로 콩콩 움직임
      const dir = Math.atan2(g.it.pos[0] - player.pos.x, g.it.pos[2] - player.pos.z);
      a.position.set(player.pos.x, 0.08, player.pos.z);
      a.rotation.y = dir;
      a.children[0].position.z = 1.5 + Math.sin(state.clock.elapsedTime * 5) * 0.25;
    }
  });

  const arrowGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 1.1);
    shape.lineTo(0.55, 0.35);
    shape.lineTo(0.22, 0.35);
    shape.lineTo(0.22, -0.5);
    shape.lineTo(-0.22, -0.5);
    shape.lineTo(-0.22, 0.35);
    shape.lineTo(-0.55, 0.35);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.15, bevelEnabled: false });
    g.translate(0, 0, -0.075);
    g.rotateX(Math.PI / 2); // 화살표 끝이 +z 를 향하도록 눕힘
    g.scale(1.1, 1, 1.1);
    return g;
  }, []);

  return (
    <group ref={arrow} visible={false}>
      <mesh geometry={arrowGeo} position={[0, 0, 1.5]} material={mat('#ffd34d', { emissive: '#ffb300', emissiveIntensity: 0.6 })} />
    </group>
  );
}
