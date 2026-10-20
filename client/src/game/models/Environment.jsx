import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat, PALETTE } from '../materials.js';
import { PADDIES, PADDY_SIZE, WEEDY_PADDIES, SPARROW_PADDY } from '../data/world.js';

const nonIndexed = (g) => (g.index ? g.toNonIndexed() : g);

// 결정적 난수 (매번 같은 마을 모양)
export function rng(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── 하늘 (그라데이션 돔) ─────────────────────────────
export function Sky() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color('#56b4f5') },
          mid: { value: new THREE.Color('#9fdcff') },
          bottom: { value: new THREE.Color('#fff1d0') },
        },
        vertexShader: `varying vec3 vPos; void main(){ vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vPos;
          void main(){ float h = vPos.y; vec3 c = h > 0.15 ? mix(mid, top, smoothstep(0.15, 0.7, h)) : mix(bottom, mid, smoothstep(-0.05, 0.15, h));
          gl_FragColor = vec4(c, 1.0); }`,
      }),
    [],
  );
  return (
    <mesh material={material} renderOrder={-1}>
      <sphereGeometry args={[900, 24, 16]} />
    </mesh>
  );
}

// ── 구름 (로우폴리 뭉게구름) ─────────────────────────
const cloudGeo = new THREE.IcosahedronGeometry(1, 1);
const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.25 });

export function Clouds() {
  const clouds = useMemo(() => {
    const r = rng(42);
    const list = [];
    // 인트로에서 카메라가 뚫고 지나가는 큰 구름
    list.push({ pos: [0, 72, 192], scale: 9, puffs: 7 });
    list.push({ pos: [-22, 66, 200], scale: 7, puffs: 5 });
    list.push({ pos: [24, 76, 185], scale: 8, puffs: 6 });
    // 인트로 시작 지점 아래의 구름 바다
    for (let i = 0; i < 18; i++) {
      list.push({ pos: [(r() - 0.5) * 160, 58 + r() * 14, 200 + r() * 120], scale: 6 + r() * 6, puffs: 4 + Math.floor(r() * 3) });
    }
    for (let i = 0; i < 26; i++) {
      list.push({
        pos: [(r() - 0.5) * 420, 55 + r() * 45, -220 + r() * 480],
        scale: 4 + r() * 6,
        puffs: 3 + Math.floor(r() * 4),
      });
    }
    return list.map((c, i) => {
      const rr = rng(i + 7);
      return {
        ...c,
        parts: Array.from({ length: c.puffs }, (_, j) => ({
          p: [(j - c.puffs / 2) * 1.3 + rr() * 0.6, rr() * 0.8, (rr() - 0.5) * 1.6],
          s: 0.9 + rr() * 0.9,
        })),
      };
    });
  }, []);
  const group = useRef();
  useFrame((_, dt) => {
    group.current.children.forEach((c, i) => {
      if (i < 3) return; // 인트로용 구름은 고정
      c.position.x += dt * (0.6 + (i % 3) * 0.3);
      if (c.position.x > 240) c.position.x = -240;
    });
  });
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={c.pos} scale={c.scale}>
          {c.parts.map((part, j) => (
            <mesh key={j} geometry={cloudGeo} material={cloudMat} position={part.p} scale={[part.s, part.s * 0.75, part.s]} />
          ))}
        </group>
      ))}
    </group>
  );
}

// ── 땅, 길, 광장 ─────────────────────────────────────
export function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 40]} material={mat(PALETTE.grass)} receiveShadow>
        <planeGeometry args={[900, 900]} />
      </mesh>
      {/* 광장 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} material={mat('#f1dfb8')} receiveShadow>
        <circleGeometry args={[21, 40]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} material={mat('#e3cb9a')} receiveShadow>
        <ringGeometry args={[20, 21, 40]} />
      </mesh>
      {/* 길: 광장 → 마을 입구 → 들판 */}
      <Path from={[0, 18]} to={[0, 124]} width={6} />
      <Path from={[-20, 0]} to={[-60, 0]} width={5} />
      <Path from={[19, 4]} to={[60, 4]} width={5} />
      <Path from={[0, -19]} to={[0, -30]} width={5} />
      <Path from={[14, -16]} to={[27, -28]} width={4} />
      <Path from={[-16, 14]} to={[-26, 26]} width={4} />
      {/* 논두렁 가로길 */}
      {[49.5, 67, 85, 103, 121].map((z) => (
        <Path key={z} from={[-52, z]} to={[52, z]} width={2.4} color="#d8b77e" />
      ))}
    </group>
  );
}

function Path({ from, to, width, color = PALETTE.path }) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, -Math.atan2(dx, dz) + Math.PI]}
      position={[(from[0] + to[0]) / 2, 0.012, (from[1] + to[1]) / 2]}
      material={mat(color)}
      receiveShadow
    >
      <planeGeometry args={[width, len]} />
    </mesh>
  );
}

// ── 황금 벼 (InstancedMesh + 바람 셰이더) ────────────
function makeRiceGeometry() {
  const stem = new THREE.ConeGeometry(0.16, 1.15, 4, 1);
  stem.translate(0, 0.575, 0);
  const head = new THREE.IcosahedronGeometry(0.17, 0);
  head.scale(0.8, 1.6, 0.8);
  head.translate(0.08, 1.05, 0);
  const head2 = new THREE.IcosahedronGeometry(0.14, 0);
  head2.scale(0.8, 1.5, 0.8);
  head2.translate(-0.12, 0.9, 0.06);
  const g = mergeGeometries([stem, head, head2].map(nonIndexed));
  g.computeVertexNormals();
  return g;
}

export const windUniforms = { uTime: { value: 0 } };

function windMaterial(color, strength = 0.22) {
  const m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.75 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float h = max(position.y, 0.0);
        float gust = sin(uTime * 1.3 + wp.x * 0.09 + wp.z * 0.13) * 0.6 + sin(uTime * 2.9 + wp.x * 0.4 + wp.z * 0.2) * 0.25 + 0.35;
        transformed.x += gust * h * h * ${strength.toFixed(3)};
        transformed.z += gust * h * h * ${(strength * 0.4).toFixed(3)};`,
      );
  };
  return m;
}

export function RiceFields() {
  const { geometry, material, matrices, colors } = useMemo(() => {
    const geometry = makeRiceGeometry();
    const material = windMaterial('#ffffff');
    const r = rng(7);
    const matrices = [];
    const colors = [];
    const golds = ['#f6c445', '#f4b93b', '#f9d25c', '#eeb030', '#f7cc4f'].map((c) => new THREE.Color(c));
    const o = new THREE.Object3D();
    const weedy = new Set(WEEDY_PADDIES.map((w) => `${w.x},${w.z}`));
    for (const pd of PADDIES) {
      const sparse = weedy.has(`${pd.x},${pd.z}`);
      const step = sparse ? 1.6 : 0.95;
      for (let x = -PADDY_SIZE.w / 2 + 0.8; x <= PADDY_SIZE.w / 2 - 0.8; x += step) {
        for (let z = -PADDY_SIZE.d / 2 + 0.8; z <= PADDY_SIZE.d / 2 - 0.8; z += step) {
          const px = pd.x + x + (r() - 0.5) * 0.4;
          const pz = pd.z + z + (r() - 0.5) * 0.4;
          o.position.set(px, 0, pz);
          o.rotation.set(0, r() * Math.PI * 2, 0);
          const s = 0.85 + r() * 0.35;
          o.scale.set(s, s * (sparse ? 0.8 : 1), s);
          o.updateMatrix();
          matrices.push(o.matrix.clone());
          colors.push(golds[Math.floor(r() * golds.length)]);
        }
      }
    }
    return { geometry, material, matrices, colors };
  }, []);

  const ref = useRef();
  const init = (mesh) => {
    if (!mesh || mesh.userData.ready) return;
    matrices.forEach((m, i) => {
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, colors[i]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.userData.ready = true;
    ref.current = mesh;
  };

  useFrame((state) => {
    windUniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <group>
      <instancedMesh ref={init} args={[geometry, material, matrices.length]} castShadow receiveShadow frustumCulled={false} />
      {PADDIES.map((pd) => (
        <PaddyBed key={`${pd.x},${pd.z}`} {...pd} />
      ))}
    </group>
  );
}

function PaddyBed({ x, z }) {
  const { w, d } = PADDY_SIZE;
  const dike = mat('#b98856');
  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={mat('#a77a4c')} receiveShadow>
        <planeGeometry args={[w, d]} />
      </mesh>
      <mesh position={[0, 0.12, -d / 2]} material={dike} receiveShadow castShadow>
        <boxGeometry args={[w + 0.6, 0.25, 0.6]} />
      </mesh>
      <mesh position={[0, 0.12, d / 2]} material={dike} receiveShadow castShadow>
        <boxGeometry args={[w + 0.6, 0.25, 0.6]} />
      </mesh>
      <mesh position={[-w / 2, 0.12, 0]} material={dike} receiveShadow castShadow>
        <boxGeometry args={[0.6, 0.25, d]} />
      </mesh>
      <mesh position={[w / 2, 0.12, 0]} material={dike} receiveShadow castShadow>
        <boxGeometry args={[0.6, 0.25, d]} />
      </mesh>
    </group>
  );
}

// ── 잡초 (우렁이를 풀면 사라짐) ─────────────────────
const weedGeo = (() => {
  const blades = [];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.ConeGeometry(0.1, 0.9, 3);
    b.translate(0, 0.45, 0);
    b.rotateZ((i - 1.5) * 0.35);
    b.rotateY(i * 1.3);
    blades.push(nonIndexed(b));
  }
  return mergeGeometries(blades);
})();
const weedMat = windMaterial('#4f9e3a', 0.35);

export function Weeds({ x, z, cleared }) {
  const ref = useRef();
  const positions = useMemo(() => {
    const r = rng(Math.abs(x * 31 + z));
    return Array.from({ length: 70 }, () => [x + (r() - 0.5) * (PADDY_SIZE.w - 2), z + (r() - 0.5) * (PADDY_SIZE.d - 2), 0.8 + r() * 0.7, r() * 6]);
  }, [x, z]);
  const scale = useRef(cleared ? 0 : 1);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    const target = cleared ? 0 : 1;
    if (!ref.current || (Math.abs(scale.current - target) < 0.001 && ref.current.userData.ready)) return;
    scale.current = THREE.MathUtils.damp(scale.current, target, 1.2, dt);
    positions.forEach(([px, pz, s, rot], i) => {
      o.position.set(px, 0, pz);
      o.rotation.set(0, rot, 0);
      o.scale.setScalar(s * scale.current + 0.0001);
      o.updateMatrix();
      ref.current.setMatrixAt(i, o.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.userData.ready = true;
  });
  return <instancedMesh ref={ref} args={[weedGeo, weedMat, positions.length]} castShadow frustumCulled={false} />;
}

// ── 단풍 나무, 산, 볏단 ─────────────────────────────
const canopyColors = ['#ff9f43', '#ff7b54', '#ffd166', '#f6b93b', '#9ccc65', '#e8664a'];

export function Tree({ color = '#ff9f43', scale = 1, ...props }) {
  return (
    <group scale={scale} {...props}>
      <mesh position={[0, 1, 0]} material={mat(PALETTE.woodDark)} castShadow>
        <cylinderGeometry args={[0.22, 0.32, 2, 6]} />
      </mesh>
      <mesh position={[0, 2.8, 0]} material={mat(color)} castShadow>
        <icosahedronGeometry args={[1.5, 0]} />
      </mesh>
      <mesh position={[0.6, 2.3, 0.4]} material={mat(color)} castShadow>
        <icosahedronGeometry args={[0.9, 0]} />
      </mesh>
    </group>
  );
}

export function Trees() {
  const trees = useMemo(() => {
    const r = rng(99);
    const list = [];
    const blocked = (x, z) =>
      Math.hypot(x, z) < 24 || // 광장
      (Math.abs(x) < 5 && z > -32) || // 도로
      (z > 46 && z < 124 && Math.abs(x) < 52) || // 들판
      (Math.abs(x) < 10 && z < -26 && z > -54) || // 온실
      (x > 20 && x < 36 && z < -24 && z > -40) || // 창고
      (x < -22 && x > -38 && z > -9 && z < 6) || // 방앗간
      (x > 18 && x < 40 && z > -2 && z < 22) || // 장터
      (Math.abs(z - 4) < 4 && x > 18) ||
      (Math.abs(z) < 4 && x < -18) ||
      (x < -10 && x > -42 && z > 16 && z < 40) || // 집, 빨랫줄
      (x > 30 && x < 46 && z > 20 && z < 34);
    for (let i = 0; i < 160 && list.length < 70; i++) {
      const x = (r() - 0.5) * 120;
      const z = -55 + r() * 180;
      if (blocked(x, z)) continue;
      list.push({ pos: [x, 0, z], color: canopyColors[Math.floor(r() * canopyColors.length)], scale: 0.9 + r() * 0.8, rot: r() * 6 });
    }
    // 바깥 경계 숲
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2;
      const x = Math.cos(a) * 74 + (r() - 0.5) * 8;
      const z = 35 + Math.sin(a) * 100 + (r() - 0.5) * 8;
      list.push({ pos: [x, 0, z], color: canopyColors[Math.floor(r() * canopyColors.length)], scale: 1.3 + r(), rot: r() * 6 });
    }
    return list;
  }, []);
  return trees.map((t, i) => <Tree key={i} position={t.pos} color={t.color} scale={t.scale} rotation={[0, t.rot, 0]} />);
}

export function Mountains() {
  const mountains = useMemo(() => {
    const r = rng(5);
    const colors = ['#9cc46a', '#d9a35f', '#b5c26a', '#e8b46d', '#8fbf6a'];
    return Array.from({ length: 22 }, (_, i) => {
      const a = (i / 22) * Math.PI * 2 + r() * 0.2;
      return {
        pos: [Math.cos(a) * 360, 0, 40 + Math.sin(a) * 380],
        h: 40 + r() * 45,
        rad: 80 + r() * 50,
        color: colors[i % colors.length],
      };
    });
  }, []);
  return mountains.map((m, i) => (
    <mesh key={i} position={[m.pos[0], m.h / 2 - 2, m.pos[2]]} material={mat(m.color)}>
      <coneGeometry args={[m.rad, m.h, 6]} />
    </mesh>
  ));
}

export function HayBales() {
  const bales = [
    [-8, 52], [-9.5, 53.2], [9, 60], [-50, 70], [50, 84], [-8, 118], [12, 120], [-28, 48], [30, 48],
  ];
  return bales.map(([x, z], i) => (
    <group key={i} position={[x, 0.55, z]} rotation={[0, i * 1.1, Math.PI / 2]}>
      <mesh material={mat('#e8c25a')} castShadow receiveShadow>
        <cylinderGeometry args={[0.6, 0.6, 1.1, 10]} />
      </mesh>
      <mesh material={mat('#d4a93c')}>
        <cylinderGeometry args={[0.61, 0.61, 0.15, 10]} />
      </mesh>
    </group>
  ));
}

export { SPARROW_PADDY };
