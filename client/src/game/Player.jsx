import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../store.js';
import { player, cam } from './runtime.js';
import { getMoveInput } from './input.js';
import { COLLIDERS, WORLD_BOUNDS } from './data/world.js';
import { Villager } from './models/Characters.jsx';
import { sfx } from '../sfx.js';

const RADIUS = 0.45;
const WALK = 6;
const RUN = 9.5;

function resolveCollisions(p) {
  for (const c of COLLIDERS) {
    if (c.c) {
      const dx = p.x - c.c[0];
      const dz = p.z - c.c[1];
      const d = Math.hypot(dx, dz);
      const min = c.r + RADIUS;
      if (d < min && d > 1e-4) {
        p.x = c.c[0] + (dx / d) * min;
        p.z = c.c[1] + (dz / d) * min;
      }
    } else {
      const [x0, z0, x1, z1] = c.b;
      const nx = Math.max(x0, Math.min(p.x, x1));
      const nz = Math.max(z0, Math.min(p.z, z1));
      const dx = p.x - nx;
      const dz = p.z - nz;
      const d = Math.hypot(dx, dz);
      if (d < RADIUS) {
        if (d > 1e-4) {
          p.x = nx + (dx / d) * RADIUS;
          p.z = nz + (dz / d) * RADIUS;
        } else {
          // 박스 안쪽: 가장 가까운 면으로 밀어냄
          const push = [p.x - x0, x1 - p.x, p.z - z0, z1 - p.z];
          const m = Math.min(...push);
          if (m === push[0]) p.x = x0 - RADIUS;
          else if (m === push[1]) p.x = x1 + RADIUS;
          else if (m === push[2]) p.z = z0 - RADIUS;
          else p.z = z1 + RADIUS;
        }
      }
    }
  }
  p.x = THREE.MathUtils.clamp(p.x, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX);
  p.z = THREE.MathUtils.clamp(p.z, WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ);
}

export function Player() {
  const ref = useRef();
  const stride = useRef(0);
  const outfit = useGame((s) => s.profile?.outfit);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const { phase, dialog } = useGame.getState();
    let moving = false;
    if (phase === 'play' && !dialog) {
      const { forward, right, run } = getMoveInput();
      if (Math.abs(forward) + Math.abs(right) > 0.05) {
        // 카메라 기준 방향 → 월드 방향
        const sin = Math.sin(cam.yaw);
        const cos = Math.cos(cam.yaw);
        const dx = -sin * forward + cos * right;
        const dz = -cos * forward - sin * right;
        const mag = Math.min(1, Math.hypot(forward, right));
        const speed = (run ? RUN : WALK) * mag;
        player.pos.x += (dx / Math.hypot(dx, dz)) * speed * dt;
        player.pos.z += (dz / Math.hypot(dx, dz)) * speed * dt;
        resolveCollisions(player.pos);
        const target = Math.atan2(dx, dz);
        let diff = target - player.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        player.heading += diff * Math.min(1, dt * 12);
        player.speed = THREE.MathUtils.damp(player.speed, speed, 10, dt);
        moving = true;
        // 발소리: 광장(돌바닥)과 그 밖(흙/풀)을 구분
        stride.current += speed * dt;
        if (stride.current > 1.5) {
          stride.current = 0;
          sfx.play(Math.hypot(player.pos.x, player.pos.z) < 21 ? 'stepStone' : 'stepGrass');
        }
      }
    }
    if (!moving) player.speed = THREE.MathUtils.damp(player.speed, 0, 10, dt);
    if (ref.current) {
      ref.current.position.copy(player.pos);
      ref.current.rotation.y = player.heading;
    }
  });

  return (
    <group ref={ref}>
      <Villager overall={outfit?.overall} shirt={outfit?.shirt} motion={player} hatBand="#e2574c" />
    </group>
  );
}
