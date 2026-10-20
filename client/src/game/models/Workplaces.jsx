import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { mat, PALETTE } from '../materials.js';
import { Label, useCanvasTexture, FONT } from '../canvasText.jsx';
import { PLACES, ELDERS, SPARROW_PADDY, WEEDY_PADDIES, PADDY_SIZE } from '../data/world.js';
import { Villager, Sparrow, Snail, StrawHat } from './Characters.jsx';
import { rng } from './Environment.jsx';

export const TTEOK_COLORS = { tteok_white: '#fffaf0', tteok_ssuk: '#8bbf5a', tteok_pumpkin: '#ffc94a' };

export function Tteok({ color = '#fffaf0', ...props }) {
  return (
    <group {...props}>
      <mesh rotation={[0, 0, Math.PI / 2]} material={mat(color, { roughness: 0.5 })} castShadow>
        <capsuleGeometry args={[0.12, 0.7, 3, 8]} />
      </mesh>
    </group>
  );
}

// 김이 모락모락
function Steam({ count = 4, ...props }) {
  const ref = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ref.current?.children.forEach((c, i) => {
      const k = (t * 0.4 + i / count) % 1;
      c.position.set(Math.sin(t + i) * 0.15, k * 1.4, 0);
      c.scale.setScalar(0.15 + k * 0.3);
      c.material.opacity = 0.6 * (1 - k);
    });
  });
  return (
    <group ref={ref} {...props}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.5} depthWrite={false} flatShading />
        </mesh>
      ))}
    </group>
  );
}

// ── 방앗간 ───────────────────────────────────────────
export function Mill() {
  const wheel = useRef();
  useFrame((_, dt) => {
    if (wheel.current) wheel.current.rotation.z -= dt * 0.8;
  });
  return (
    <group>
      <group position={PLACES.mill}>
        <mesh position={[0, 2, 0]} material={mat('#f5e6c8')} castShadow receiveShadow>
          <boxGeometry args={[9, 4, 8]} />
        </mesh>
        <mesh position={[0, 5, 0]} rotation={[0, 0, 0]} material={mat('#8b5a3c')} castShadow>
          <cylinderGeometry args={[0.1, 6.4, 2.4, 4, 1]} />
        </mesh>
        {/* 나무 기둥 장식 */}
        {[-4.5, 4.5].map((x) =>
          [-4, 4].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 2, z]} material={mat(PALETTE.woodDark)}>
              <boxGeometry args={[0.35, 4, 0.35]} />
            </mesh>
          )),
        )}
        {/* 입구 (동쪽) */}
        <mesh position={[4.52, 1.3, 0]} material={mat(PALETTE.woodDark)}>
          <boxGeometry args={[0.1, 2.6, 2]} />
        </mesh>
        <Label text="가래떡 방앗간" width={3.6} height={0.9} bg="#fff4d6" border="#8b5a3c" fontSize={0.5} position={[4.56, 3.3, 0]} rotation={[0, Math.PI / 2, 0]} />
        {/* 물레방아 (북쪽) */}
        <group ref={wheel} position={[0, 2.2, -4.9]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={mat(PALETTE.wood)} castShadow>
            <cylinderGeometry args={[2, 2, 0.6, 12, 1, true]} />
          </mesh>
          {Array.from({ length: 8 }, (_, i) => (
            <mesh key={i} rotation={[0, 0, (i / 8) * Math.PI]} material={mat(PALETTE.woodDark)}>
              <boxGeometry args={[0.15, 4.2, 0.5]} />
            </mesh>
          ))}
        </group>
        {/* 굴뚝 + 김 */}
        <mesh position={[-2.5, 6, 2]} material={mat('#9a8f80')} castShadow>
          <boxGeometry args={[0.8, 2.4, 0.8]} />
        </mesh>
        <Steam position={[-2.5, 7.3, 2]} />
      </group>
      {/* 떡 쟁반 테이블 */}
      <group position={PLACES.tteokTray}>
        <mesh position={[0, 0.45, 0]} material={mat(PALETTE.wood)} castShadow receiveShadow>
          <boxGeometry args={[2.2, 0.9, 1.6]} />
        </mesh>
        <mesh position={[0, 0.92, 0]} material={mat('#e9c58a')}>
          <cylinderGeometry args={[0.9, 0.9, 0.06, 12]} />
        </mesh>
        <Steam position={[0, 1.2, 0]} count={3} />
      </group>
      <Villager position={PLACES.miller} rotation={[0, Math.PI / 2, 0]} overall="#ffffff" shirt="#f5e6c8" hat="scarf" hatBand="#ffffff" />
    </group>
  );
}

// ── 장터 ─────────────────────────────────────────────
function Stall({ awning = '#e2574c', goods = '#ff7b54', ...props }) {
  const r = useMemo(() => rng(awning.length * 13 + goods.charCodeAt(1)), [awning, goods]);
  const items = useMemo(() => Array.from({ length: 6 }, () => [(r() - 0.5) * 2.6, (r() - 0.5) * 1.2]), [r]);
  return (
    <group {...props}>
      <mesh position={[0, 0.5, 0]} material={mat(PALETTE.wood)} castShadow receiveShadow>
        <boxGeometry args={[3.6, 1, 2]} />
      </mesh>
      {[-1.7, 1.7].map((x) =>
        [-0.9, 0.9].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 1.6, z]} material={mat(PALETTE.woodDark)}>
            <cylinderGeometry args={[0.07, 0.07, 3.2, 5]} />
          </mesh>
        )),
      )}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[-1.65 + i * 0.66, 3.2, 0]} rotation={[0.25, 0, 0]} material={mat(i % 2 ? '#ffffff' : awning)} castShadow>
          <boxGeometry args={[0.66, 0.08, 2.6]} />
        </mesh>
      ))}
      {items.map(([x, z], i) => (
        <mesh key={i} position={[x, 1.15, z]} scale={[1, 0.8, 1]} material={mat(goods)} castShadow>
          <icosahedronGeometry args={[0.2, 0]} />
        </mesh>
      ))}
    </group>
  );
}

export function Market({ flags }) {
  return (
    <group>
      <Stall position={[22.5, 0, 2.2]} awning="#e2574c" goods="#ff7b54" />
      <Stall position={[28.5, 0, 2.2]} awning="#3b7dd8" goods="#ffb347" />
      <Stall position={[34.5, 0, 2.2]} awning="#3cb371" goods="#9ccc65" />
      <Label text="가래떡 마을 장터" width={4.4} height={1} bg="#fff4d6" border="#e2574c" fontSize={0.55} position={[28.5, 4.4, 3.4]} />
      {/* 평상 */}
      <group position={PLACES.pyeongsang}>
        <mesh position={[0, 0.45, 0]} material={mat('#c99a66')} castShadow receiveShadow>
          <boxGeometry args={[8, 0.2, 2.8]} />
        </mesh>
        {[-3.7, 3.7].map((x) =>
          [-1.2, 1.2].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 0.2, z]} material={mat(PALETTE.woodDark)}>
              <boxGeometry args={[0.25, 0.4, 0.25]} />
            </mesh>
          )),
        )}
      </group>
      {ELDERS.map((e, i) => (
        <Elder key={e.id} elder={e} index={i} served={!!flags[e.id]} />
      ))}
    </group>
  );
}

function Elder({ elder, index, served }) {
  const bubble = useRef();
  useFrame((state) => {
    if (bubble.current) bubble.current.position.y = 3.0 + Math.sin(state.clock.elapsedTime * 2 + index) * 0.1;
  });
  const outfits = [
    { overall: '#c77dff', shirt: '#ffe6f0', hat: 'scarf', hatBand: '#ff9aa2' },
    { overall: '#6b8e9e', shirt: '#f5f5f5', hat: 'none', beard: true },
    { overall: '#ff9f43', shirt: '#fff4d6', hat: 'scarf', hatBand: '#9fdcff' },
  ][index];
  return (
    <group position={elder.pos}>
      <Villager {...outfits} hair="#e6e6e6" scale={0.95} />
      <group ref={bubble}>
        {served ? (
          <Label text="❤️" width={0.9} height={0.9} bg={null} fontSize={0.6} />
        ) : (
          <group>
            <mesh material={mat('#ffffff')}>
              <sphereGeometry args={[0.55, 12, 10]} />
            </mesh>
            <Tteok color={TTEOK_COLORS[elder.want]} position={[0, 0, 0.45]} scale={0.7} />
          </group>
        )}
      </group>
    </group>
  );
}

// ── 온실 (스마트팜) ──────────────────────────────────
export function Greenhouse({ fixed }) {
  const [gx, , gz] = PLACES.greenhouse;
  const glass = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#cfefff', transparent: true, opacity: 0.22, roughness: 0.1, depthWrite: false, side: THREE.DoubleSide }),
    [],
  );
  const frame = mat('#f5f5f5');
  const L = 22;
  const W = 14;
  return (
    <group position={[gx, 0, gz]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={mat('#c9a37a')} receiveShadow>
        <planeGeometry args={[W, L]} />
      </mesh>
      {/* 아치형 지붕 */}
      <mesh position={[0, 3, 0]} rotation={[Math.PI / 2, 0, 0]} material={glass}>
        <cylinderGeometry args={[7, 7, L, 16, 1, true, Math.PI / 2, Math.PI]} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[0, 3, -L / 2 + (i * L) / 5]} material={frame}>
          <torusGeometry args={[7, 0.08, 4, 16, Math.PI]} />
        </mesh>
      ))}
      {/* 옆 벽 */}
      {[-W / 2, W / 2].map((x) => (
        <mesh key={x} position={[x, 1.5, 0]} material={glass}>
          <boxGeometry args={[0.05, 3, L]} />
        </mesh>
      ))}
      {/* 뒷벽, 앞벽 (가운데 출입문) */}
      {[-L / 2, L / 2].map((z) => (
        <mesh key={z} position={[0, 3, z]} material={glass}>
          <circleGeometry args={[7, 16, 0, Math.PI]} />
        </mesh>
      ))}
      <mesh position={[0, 1.5, -L / 2]} material={glass}>
        <boxGeometry args={[W, 3, 0.05]} />
      </mesh>
      {[-4.4, 4.4].map((x) => (
        <mesh key={x} position={[x, 1.5, L / 2]} material={glass}>
          <boxGeometry args={[5.2, 3, 0.05]} />
        </mesh>
      ))}
      <Label text="🌶️ 스마트팜 온실" width={4} height={0.9} bg="#3cb371" color="#ffffff" fontSize={0.5} position={[0, 6, L / 2 + 0.1]} />
      {/* 파프리카 밭 */}
      {[-4, 4].map((x) => (
        <PaprikaBed key={x} position={[x, 0, -1.5]} healthy={fixed} />
      ))}
      <Sprinklers fixed={fixed} />
      <Console fixed={fixed} position={[PLACES.console[0] - gx, 0, PLACES.console[2] - gz]} />
    </group>
  );
}

function PaprikaBed({ healthy, ...props }) {
  const plants = useMemo(() => {
    const r = rng(props.position[0] + 50);
    return Array.from({ length: 12 }, (_, i) => ({
      z: -6.5 + i * 1.2,
      fruits: Array.from({ length: 3 }, () => [(r() - 0.5) * 0.7, 0.6 + r() * 0.6, (r() - 0.5) * 0.5, ['#e8382f', '#ffcc33', '#ff8c1a'][Math.floor(r() * 3)]]),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const leaf = healthy ? '#4caf50' : '#a9a05a';
  return (
    <group {...props}>
      <mesh position={[0, 0.2, 0]} material={mat('#8b5a3c')} receiveShadow castShadow>
        <boxGeometry args={[2.2, 0.4, 15]} />
      </mesh>
      {plants.map((p, i) => (
        <group key={i} position={[0, 0.4, p.z]} scale={healthy ? 1 : [1, 0.7, 1]}>
          <mesh position={[0, 0.6, 0]} material={mat(leaf)} castShadow>
            <icosahedronGeometry args={[0.55, 0]} />
          </mesh>
          {healthy &&
            p.fruits.map(([x, y, z, c], j) => (
              <mesh key={j} position={[x, y, z + 0.3]} scale={[1, 1.2, 1]} material={mat(c, { roughness: 0.4 })}>
                <icosahedronGeometry args={[0.16, 1]} />
              </mesh>
            ))}
        </group>
      ))}
    </group>
  );
}

function Sprinklers({ fixed }) {
  const N = 600;
  const ref = useRef();
  const seeds = useMemo(() => {
    const r = rng(3);
    return Array.from({ length: N }, () => [r() < 0.5 ? -4 : 4, -8 + r() * 13, r(), r() * Math.PI * 2]);
  }, []);
  const positions = useMemo(() => new Float32Array(N * 3), []);
  useFrame((state) => {
    if (!fixed || !ref.current) return;
    const t = state.clock.elapsedTime;
    seeds.forEach(([x, z, o, a], i) => {
      const k = (t * 0.9 + o) % 1;
      positions[i * 3] = x + Math.cos(a) * k * 1.2;
      positions[i * 3 + 1] = 4.2 - k * 3.4;
      positions[i * 3 + 2] = z + Math.sin(a) * k * 0.8;
    });
    ref.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <group>
      {[-4, 4].map((x) =>
        [-6, -1.5, 3].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 4.3, z]} material={mat('#9aa5b1')}>
            <cylinderGeometry args={[0.1, 0.2, 0.25, 6]} />
          </mesh>
        )),
      )}
      <mesh position={[-4, 4.45, -1.5]} rotation={[Math.PI / 2, 0, 0]} material={mat('#9aa5b1')}>
        <cylinderGeometry args={[0.05, 0.05, 15, 4]} />
      </mesh>
      <mesh position={[4, 4.45, -1.5]} rotation={[Math.PI / 2, 0, 0]} material={mat('#9aa5b1')}>
        <cylinderGeometry args={[0.05, 0.05, 15, 4]} />
      </mesh>
      {fixed && (
        <points ref={ref} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" array={positions} count={N} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial color="#7fd4ff" size={0.12} transparent opacity={0.85} depthWrite={false} />
        </points>
      )}
    </group>
  );
}

function Console({ fixed, ...props }) {
  const tex = useCanvasTexture(
    512,
    320,
    (ctx, w, h) => {
      ctx.fillStyle = fixed ? '#0f3d24' : '#3d0f0f';
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = fixed ? '#7dffb0' : '#ff7d7d';
      ctx.font = `46px ${FONT}`;
      if (fixed) {
        ctx.fillText('✅ 정상 작동 중', w / 2, 70);
        ctx.font = `38px ${FONT}`;
        ctx.fillText('🌡️ 온도 22℃   💧 습도 65%', w / 2, 160);
        ctx.fillText('스프링클러 ON', w / 2, 240);
      } else {
        ctx.fillText('⚠️ 오류 발생!', w / 2, 80);
        ctx.font = `38px ${FONT}`;
        ctx.fillText('온·습도 센서 없음', w / 2, 170);
        ctx.fillText('[ 센서 슬롯 비어 있음 ]', w / 2, 245);
      }
    },
    [fixed],
  );
  const light = useRef();
  useFrame((state) => {
    if (light.current && !fixed) light.current.material.emissiveIntensity = Math.sin(state.clock.elapsedTime * 6) > 0 ? 1 : 0.1;
  });
  return (
    <group {...props}>
      <mesh position={[0, 0.6, 0]} material={mat('#d0d6de')} castShadow>
        <boxGeometry args={[1.6, 1.2, 0.8]} />
      </mesh>
      <mesh position={[0, 1.6, -0.1]} rotation={[-0.25, 0, 0]} material={mat('#5d6b7a')} castShadow>
        <boxGeometry args={[1.9, 1.3, 0.15]} />
      </mesh>
      <mesh position={[0, 1.6, -0.01]} rotation={[-0.25, 0, 0]}>
        <planeGeometry args={[1.7, 1.06]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh ref={light} position={[0, 2.45, -0.1]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshStandardMaterial color={fixed ? '#3cff8a' : '#ff3c3c'} emissive={fixed ? '#3cff8a' : '#ff3c3c'} emissiveIntensity={1} />
      </mesh>
    </group>
  );
}

// ── 창고 (헛간) ──────────────────────────────────────
export function Shed() {
  const wood = mat('#b5814f');
  return (
    <group position={PLACES.shed}>
      <mesh position={[0, 2, -4.4]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[10, 4, 0.8]} />
      </mesh>
      {[-4.5, 4.5].map((x) => (
        <mesh key={x} position={[x, 2, 0]} material={wood} castShadow receiveShadow>
          <boxGeometry args={[1, 4, 9.6]} />
        </mesh>
      ))}
      <mesh position={[0, 4.6, -0.2]} rotation={[0.12, 0, 0]} material={mat('#e2574c')} castShadow>
        <boxGeometry args={[11, 0.3, 10.4]} />
      </mesh>
      <Label text="농기구 창고" width={3} height={0.8} bg="#fff4d6" border="#7a5233" fontSize={0.45} position={[0, 3.9, 4.85]} />
      {/* 선반 */}
      <mesh position={[0, 1.1, -3.4]} material={mat(PALETTE.woodDark)} castShadow>
        <boxGeometry args={[6, 0.15, 1.2]} />
      </mesh>
      {[-2.9, 2.9].map((x) => (
        <mesh key={x} position={[x, 0.55, -3.4]} material={mat(PALETTE.woodDark)}>
          <boxGeometry args={[0.15, 1.1, 1.1]} />
        </mesh>
      ))}
      {/* 상자, 삽, 자루 */}
      {[[-2.8, 0.5, 1.5], [-2.6, 1.3, 1.4], [2.8, 0.5, -0.5]].map((p, i) => (
        <mesh key={i} position={p} rotation={[0, i, 0]} material={mat('#d9a877')} castShadow>
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      ))}
      <mesh position={[-1.2, 1.4, -3.4]} material={mat('#e8d3a8')} castShadow>
        <icosahedronGeometry args={[0.45, 0]} />
      </mesh>
      <mesh position={[3.8, 1.3, 2]} rotation={[0, 0, 0.3]} material={mat('#9aa5b1')}>
        <boxGeometry args={[0.1, 2.6, 0.1]} />
      </mesh>
    </group>
  );
}

// ── 들판: 농부, 허수아비, 참새, 잡초 논 표시 ───────────
export function FieldLife({ flags, completed }) {
  return (
    <group>
      <Villager position={PLACES.farmer} rotation={[0, -Math.PI / 2, 0]} overall="#3cb371" shirt="#ffffff" hatBand="#3b7dd8" />
      {!completed.includes('snail') && !flags.got_basket && <QuestMark position={[PLACES.farmer[0], 3.2, PLACES.farmer[2]]} />}
      <Scarecrow dressed={completed.includes('scarecrow')} />
      <SparrowFlock fled={completed.includes('scarecrow')} />
      {WEEDY_PADDIES.map((w) => (
        <WeedyMarker key={w.id} paddy={w} released={!!flags[w.id]} />
      ))}
    </group>
  );
}

export function QuestMark({ color = '#ffd34d', text = '!', ...props }) {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = Math.sin(state.clock.elapsedTime * 3) * 0.15;
      ref.current.rotation.y = state.clock.elapsedTime * 1.5;
    }
  });
  return (
    <group {...props}>
      <group ref={ref}>
        <Label text={text} width={0.9} height={0.9} bg={color} color="#5a3a1a" fontSize={0.7} />
        <Label text={text} width={0.9} height={0.9} bg={color} color="#5a3a1a" fontSize={0.7} rotation={[0, Math.PI, 0]} position={[0, 0, -0.01]} />
      </group>
    </group>
  );
}

function Scarecrow({ dressed }) {
  return (
    <group position={PLACES.scarecrow} rotation={[0, -Math.PI / 2, 0]}>
      <mesh position={[0, 1.4, 0]} material={mat(PALETTE.wood)} castShadow>
        <cylinderGeometry args={[0.09, 0.11, 2.8, 6]} />
      </mesh>
      <mesh position={[0, 2.1, 0]} rotation={[0, 0, Math.PI / 2]} material={mat(PALETTE.wood)} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 2.4, 6]} />
      </mesh>
      <mesh position={[0, 2.85, 0]} material={mat('#e8d3a8')} castShadow>
        <icosahedronGeometry args={[0.42, 1]} />
      </mesh>
      {dressed && (
        <>
          <mesh position={[0, 1.95, 0]} material={mat('#6b8e9e')} castShadow>
            <boxGeometry args={[1.1, 1.1, 0.45]} />
          </mesh>
          <mesh position={[0, 2.08, 0]} material={mat('#6b8e9e')} castShadow>
            <boxGeometry args={[2.3, 0.35, 0.35]} />
          </mesh>
          {[-0.4, 0.4].map((x) => (
            <mesh key={x} position={[x, 1.65, 0.24]} material={mat('#e2574c')}>
              <boxGeometry args={[0.25, 0.25, 0.02]} />
            </mesh>
          ))}
          <StrawHat position={[0, 3.12, 0]} scale={0.85} />
          {[-0.14, 0.14].map((x) => (
            <mesh key={`e${x}`} position={[x, 2.9, 0.38]} material={mat('#2b2018')}>
              <sphereGeometry args={[0.05, 6, 6]} />
            </mesh>
          ))}
          <mesh position={[0, 2.72, 0.38]} rotation={[0, 0, Math.PI]} material={mat('#c0504d')}>
            <torusGeometry args={[0.1, 0.02, 4, 8, Math.PI]} />
          </mesh>
        </>
      )}
      {!dressed && <QuestMark position={[0, 4, 0]} text="?" color="#ffb3a7" />}
    </group>
  );
}

function SparrowFlock({ fled }) {
  const birds = useMemo(() => {
    const r = rng(11);
    return Array.from({ length: 8 }, () => ({
      x: SPARROW_PADDY.x + (r() - 0.5) * (PADDY_SIZE.w - 3),
      z: SPARROW_PADDY.z + (r() - 0.5) * (PADDY_SIZE.d - 3),
      rot: r() * 6,
      vx: (r() - 0.5) * 6,
      vz: (r() - 0.5) * 6,
    }));
  }, []);
  const group = useRef();
  const flee = useRef(fled ? 99 : 0);
  useFrame((_, dt) => {
    if (!fled || !group.current) return;
    flee.current += dt;
    group.current.children.forEach((b, i) => {
      b.position.y += dt * (4 + i * 0.3);
      b.position.x += dt * birds[i].vx;
      b.position.z += dt * birds[i].vz;
    });
    group.current.visible = flee.current < 6;
  });
  return (
    <group ref={group} visible={!fled || flee.current < 6}>
      {birds.map((b, i) => (
        <Sparrow key={i} position={[b.x, 1.05, b.z]} rotation={[0, b.rot, 0]} hop={!fled} />
      ))}
    </group>
  );
}

function WeedyMarker({ paddy, released }) {
  const snails = useRef();
  useFrame((state) => {
    if (snails.current) snails.current.children.forEach((s, i) => {
      s.position.x = Math.sin(state.clock.elapsedTime * 0.1 + i * 2) * 5;
      s.rotation.y = Math.cos(state.clock.elapsedTime * 0.1 + i * 2) > 0 ? Math.PI / 2 : -Math.PI / 2;
    });
  });
  return (
    <group position={[paddy.x, 0, paddy.z]}>
      {!released ? (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, -PADDY_SIZE.d / 2 - 0.6]}>
            <ringGeometry args={[1.2, 1.6, 24]} />
            <meshBasicMaterial color="#ff4d4d" transparent opacity={0.85} />
          </mesh>
          <QuestMark position={[0, 3, -PADDY_SIZE.d / 2]} color="#ff6b6b" text="!" />
        </group>
      ) : (
        <group ref={snails}>
          {[-3, 0, 3, -1.5, 2].map((z, i) => (
            <Snail key={i} position={[0, 0.05, z]} scale={1.6} shell={i % 2 ? '#d98b4a' : '#c47a3a'} />
          ))}
        </group>
      )}
    </group>
  );
}
