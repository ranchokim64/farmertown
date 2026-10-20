import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../store.js';
import { INTERACTABLES } from './data/quests.js';
import { player } from './runtime.js';
import { onInteract } from './input.js';
import { mat } from './materials.js';

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
    pick: s.pick,
    take: s.take,
    setFlag: s.setFlag,
    complete: s.complete,
    say: s.say,
    toast: s.toast,
  });
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
      guideTarget.current = nearest(p, (it) => it.guide(p), Infinity);
    }
    // 길안내 화살표
    const g = guideTarget.current;
    const a = arrow.current;
    if (!a) return;
    a.visible = s.phase === 'play' && !!g && g.d > 4;
    if (a.visible) {
      const dir = Math.atan2(g.it.pos[0] - player.pos.x, g.it.pos[2] - player.pos.z);
      a.position.set(player.pos.x, 3.0 + Math.sin(state.clock.elapsedTime * 3) * 0.08, player.pos.z);
      a.rotation.y = dir;
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
    g.scale(0.7, 0.7, 0.7);
    return g;
  }, []);

  return (
    <group ref={arrow} visible={false}>
      <mesh geometry={arrowGeo} position={[0, 0, 1.1]} material={mat('#ffd34d', { emissive: '#ffb300', emissiveIntensity: 0.5 })} />
    </group>
  );
}
