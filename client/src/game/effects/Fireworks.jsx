import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGame } from '../../store.js';
import { PLACES } from '../data/world.js';

const BURSTS = 10;
const PARTICLES = 90;
const DURATION = 14; // 초
const COLORS = ['#ff5e5e', '#ffd34d', '#7dffb0', '#7fd4ff', '#ff9ff3', '#ffffff', '#ffa94d'];

export function Fireworks() {
  const bursts = useMemo(
    () =>
      Array.from({ length: BURSTS }, () => {
        const positions = new Float32Array(PARTICLES * 3);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({ size: 0.55, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
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

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const start = useGame.getState().celebrateAt;
    const active = start && (performance.now() - start) / 1000 < DURATION;
    timer.current -= dt;
    if (active && timer.current <= 0) {
      timer.current = 0.35 + Math.random() * 0.35;
      const b = bursts.find((x) => x.age > 2.2);
      if (b) {
        b.age = 0;
        b.origin.set(PLACES.dangsan[0] + (Math.random() - 0.3) * 30, 18 + Math.random() * 12, PLACES.dangsan[2] + (Math.random() - 0.5) * 20);
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
