import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGame } from '../../store.js';
import { sfx } from '../../sfx.js';

const BURSTS = 10;
const PARTICLES = 90;
const DURATION = 14; // 초
const COLORS = ['#ff5e5e', '#ffd34d', '#7dffb0', '#7fd4ff', '#ff9ff3', '#ffffff', '#ffa94d'];

// 동그랗게 빛나는 불꽃 입자 텍스처
const sparkTexture = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const fwd = new THREE.Vector3();
const side = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export function Fireworks() {
  const bursts = useMemo(
    () =>
      Array.from({ length: BURSTS }, () => {
        const positions = new Float32Array(PARTICLES * 3);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({ size: 1.3, map: sparkTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        return {
          geometry,
          material,
          positions,
          vel: new Float32Array(PARTICLES * 3),
          origin: new THREE.Vector3(),
          age: 99,
        };
      }),
    [],
  );
  const timer = useRef(0);

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const start = useGame.getState().celebrateAt;
    const active = start && (performance.now() - start) / 1000 < DURATION;
    timer.current -= dt;
    if (active && timer.current <= 0) {
      timer.current = 0.35 + Math.random() * 0.35;
      const b = bursts.find((x) => x.age > 2.2);
      if (b) {
        sfx.play('firework');
        b.age = 0;
        // 플레이어가 어디에 서 있든 보이도록 카메라가 바라보는 쪽 하늘에서 터뜨림
        camera.getWorldDirection(fwd);
        fwd.y = 0;
        fwd.normalize();
        side.crossVectors(fwd, UP);
        b.origin
          .copy(camera.position)
          .addScaledVector(fwd, 22 + Math.random() * 12)
          .addScaledVector(side, (Math.random() - 0.5) * 26);
        b.origin.y = camera.position.y + 6 + Math.random() * 7;
        b.material.color.set(COLORS[Math.floor(Math.random() * COLORS.length)]);
        for (let i = 0; i < PARTICLES; i++) {
          const u = Math.random() * 2 - 1;
          const th = Math.random() * Math.PI * 2;
          const r = Math.sqrt(1 - u * u);
          const sp = 7 + Math.random() * 3;
          b.vel[i * 3] = r * Math.cos(th) * sp;
          b.vel[i * 3 + 1] = u * sp;
          b.vel[i * 3 + 2] = r * Math.sin(th) * sp;
        }
      }
    }
    for (const b of bursts) {
      if (b.age > 2.2) {
        b.material.opacity = 0;
        continue;
      }
      b.age += dt;
      const t = b.age;
      for (let i = 0; i < PARTICLES; i++) {
        b.positions[i * 3] = b.origin.x + b.vel[i * 3] * t;
        b.positions[i * 3 + 1] = b.origin.y + b.vel[i * 3 + 1] * t - 4 * t * t;
        b.positions[i * 3 + 2] = b.origin.z + b.vel[i * 3 + 2] * t;
      }
      b.geometry.attributes.position.needsUpdate = true;
      b.material.opacity = Math.max(0, 1 - t / 2.2);
    }
  });

  return bursts.map((b, i) => <points key={i} geometry={b.geometry} material={b.material} frustumCulled={false} />);
}
