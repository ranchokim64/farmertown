import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { mat, PALETTE } from '../materials.js';
import { Label, useCanvasTexture, FONT, roundRect } from '../canvasText.jsx';
import { PLACES } from '../data/world.js';

// ── 분수대 ───────────────────────────────────────────
export function Fountain() {
  const water = useRef();
  const drops = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (water.current) water.current.position.y = 0.72 + Math.sin(t * 2) * 0.02;
    if (drops.current) drops.current.children.forEach((d, i) => {
      const k = (t * 0.9 + i / 8) % 1;
      const a = (i / 8) * Math.PI * 2;
      d.position.set(Math.cos(a) * (0.3 + k * 1.3), 2.9 + k * 0.8 - k * k * 2.5, Math.sin(a) * (0.3 + k * 1.3));
    });
  });
  return (
    <group position={PLACES.fountain}>
      <mesh position={[0, 0.4, 0]} material={mat(PALETTE.stone)} castShadow receiveShadow>
        <cylinderGeometry args={[3.2, 3.4, 0.8, 16]} />
      </mesh>
      <mesh ref={water} position={[0, 0.72, 0]} material={mat('#6fd0ff', { roughness: 0.2, transparent: true, opacity: 0.85 })}>
        <cylinderGeometry args={[2.85, 2.85, 0.2, 16]} />
      </mesh>
      <mesh position={[0, 1.5, 0]} material={mat('#e8e1d4')} castShadow>
        <cylinderGeometry args={[0.35, 0.55, 1.6, 8]} />
      </mesh>
      <mesh position={[0, 2.4, 0]} material={mat(PALETTE.stone)} castShadow>
        <cylinderGeometry args={[1.3, 0.6, 0.35, 12]} />
      </mesh>
      <mesh position={[0, 2.75, 0]} material={mat('#6fd0ff', { emissive: '#3fb0ff', emissiveIntensity: 0.3 })}>
        <sphereGeometry args={[0.32, 8, 8]} />
      </mesh>
      <group ref={drops}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} material={mat('#bfeaff', { emissive: '#7fd4ff', emissiveIntensity: 0.4 })}>
            <sphereGeometry args={[0.1, 6, 6]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ── 부서진 비석 (퀘스트 1) ──────────────────────────
export function Tablet({ solved }) {
  const tex = useCanvasTexture(
    512,
    640,
    (ctx, w, h) => {
      ctx.fillStyle = '#9d968a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#4b463f';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (solved) {
        ctx.font = `bold 150px serif`;
        ctx.fillStyle = '#ffe27a';
        ctx.fillText('土', w * 0.3, 170);
        ctx.fillText('土', w * 0.7, 170);
        ctx.font = `64px ${FONT}`;
        ctx.fillStyle = '#fff8e0';
        ctx.fillText('十一月 十一日', w / 2, 350);
        ctx.font = `56px ${FONT}`;
        ctx.fillText('11월 11일', w / 2, 440);
        ctx.font = `40px ${FONT}`;
        ctx.fillText('농업인의 날', w / 2, 530);
      } else {
        ctx.font = `48px ${FONT}`;
        ctx.fillText('?月 ?日', w / 2, 90);
        ctx.strokeStyle = '#4b463f';
        ctx.lineWidth = 8;
        ctx.setLineDash([18, 12]);
        [[90, 160], [282, 160], [90, 360], [282, 360]].forEach(([x, y]) => ctx.strokeRect(x, y, 140, 140));
        ctx.setLineDash([]);
        ctx.strokeStyle = '#5f594f';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(40, 20);
        ctx.lineTo(160, 300);
        ctx.lineTo(120, 620);
        ctx.moveTo(470, 100);
        ctx.lineTo(380, 380);
        ctx.stroke();
      }
    },
    [solved],
  );
  return (
    <group position={PLACES.tablet} rotation={[0, -0.5, 0]}>
      <mesh position={[0, 0.25, 0]} material={mat('#8f887b')} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.5, 1.2]} />
      </mesh>
      <mesh position={[0, 1.6, 0]} rotation={[0, 0, solved ? 0 : 0.04]} material={mat('#a9a296')} castShadow>
        <boxGeometry args={[1.6, 2.2, 0.35]} />
      </mesh>
      <mesh position={[0, 1.6, 0.18]}>
        <planeGeometry args={[1.5, 2.0]} />
        <meshStandardMaterial map={tex} emissive={solved ? '#ffcc33' : '#000000'} emissiveIntensity={solved ? 0.25 : 0} emissiveMap={tex} />
      </mesh>
      {!solved && (
        <mesh position={[0.95, 0.65, 0.5]} rotation={[0.3, 0.4, 0.6]} material={mat('#a9a296')} castShadow>
          <dodecahedronGeometry args={[0.3, 0]} />
        </mesh>
      )}
    </group>
  );
}

// ── 당산나무 + 감사 리본 ─────────────────────────────
const OBANG = ['#e84a3f', '#3b7dd8', '#f6c445', '#ffffff', '#2f2f2f'];

export function DangsanTree({ ribbons = 0, glowing = false }) {
  const leaf = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f2b233', flatShading: true, roughness: 0.8, emissive: '#ffd34d', emissiveIntensity: 0 }), []);
  useFrame((state) => {
    leaf.emissiveIntensity = glowing ? 0.35 + Math.sin(state.clock.elapsedTime * 3) * 0.15 : 0;
  });
  const ribbonSpots = [
    [-2.6, 4.6, 1.4], [2.4, 4.9, 1.6], [0.2, 4.4, 2.6], [-1.6, 5.2, -2.2], [2.2, 4.6, -1.8],
  ];
  return (
    <group position={PLACES.dangsan}>
      {/* 돌담 */}
      <mesh position={[0, 0.3, 0]} material={mat('#c9bfae')} castShadow receiveShadow>
        <cylinderGeometry args={[3.4, 3.6, 0.6, 14]} />
      </mesh>
      <mesh position={[0, 0.62, 0]} material={mat('#8bbf5a')}>
        <cylinderGeometry args={[3.1, 3.1, 0.06, 14]} />
      </mesh>
      {/* 줄기 */}
      <mesh position={[0, 2.6, 0]} material={mat('#7a5233')} castShadow>
        <cylinderGeometry args={[0.9, 1.5, 4.4, 8]} />
      </mesh>
      {[[-1, 0.5, 0.6], [1, -0.4, -0.5], [0.3, 0.5, -0.8]].map(([x, rz, rx], i) => (
        <mesh key={i} position={[x * 1.4, 5.2, 0]} rotation={[rx, 0, rz]} material={mat('#7a5233')} castShadow>
          <cylinderGeometry args={[0.35, 0.6, 2.8, 6]} />
        </mesh>
      ))}
      {/* 잎 */}
      {[[0, 8.2, 0, 4.2], [-3.2, 7, 1, 3], [3.2, 7.2, -0.6, 3.1], [0.8, 7, 3, 2.8], [-1, 7.4, -3, 2.9], [1.5, 9.8, 0.5, 2.5]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} material={leaf} castShadow>
          <icosahedronGeometry args={[r, 1]} />
        </mesh>
      ))}
      {/* 금줄 */}
      <mesh position={[0, 2.2, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat('#d9c08a')}>
        <torusGeometry args={[1.3, 0.08, 6, 16]} />
      </mesh>
      {/* 감사 리본 */}
      {ribbonSpots.slice(0, ribbons).map((p, i) => (
        <group key={i} position={p}>
          <mesh material={mat(OBANG[i], { side: THREE.DoubleSide })} position={[0, -0.8, 0]}>
            <boxGeometry args={[0.35, 1.6, 0.04]} />
          </mesh>
          <mesh material={mat(OBANG[i])} rotation={[0, 0, Math.PI / 4]}>
            <torusGeometry args={[0.22, 0.07, 5, 8]} />
          </mesh>
        </group>
      ))}
      <Label text="마을 당산나무" width={3.2} height={0.8} fontSize={0.42} position={[2.5, 1.4, 3.3]} rotation={[0, 0.6, 0]} />
    </group>
  );
}

// ── 광장 대형 전광판 (학교 대항전 TOP 5) ────────────
export function Scoreboard({ leaderboard, mySchoolCode }) {
  const tex = useCanvasTexture(
    1024,
    640,
    (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1d2b5a');
      g.addColorStop(1, '#0e1736');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd34d';
      ctx.font = `68px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('🏆 학교 대항전 실시간 TOP 5', w / 2, 70);
      const schools = leaderboard?.schools ?? [];
      if (!schools.length) {
        ctx.fillStyle = '#c7d4ff';
        ctx.font = `52px ${FONT}`;
        ctx.fillText(leaderboard ? '첫 번째 점수의 주인공이 되어 보세요!' : '점수판 연결 중…', w / 2, h / 2 + 20);
      }
      const medal = ['🥇', '🥈', '🥉', '4', '5'];
      schools.slice(0, 5).forEach((s, i) => {
        const y = 165 + i * 96;
        const mine = s.code === mySchoolCode;
        ctx.fillStyle = mine ? 'rgba(255, 211, 77, 0.28)' : 'rgba(255,255,255,0.07)';
        roundRect(ctx, 40, y - 42, w - 80, 84, 20);
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = `54px ${FONT}`;
        ctx.fillText(medal[i], 100, y + 2);
        ctx.textAlign = 'left';
        ctx.fillStyle = mine ? '#ffe680' : '#ffffff';
        ctx.fillText(s.name.length > 12 ? `${s.name.slice(0, 12)}…` : s.name, 160, y + 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#7dffb0';
        ctx.fillText(`${s.score.toLocaleString()}점`, w - 70, y + 2);
      });
    },
    [leaderboard, mySchoolCode],
  );
  const [x, , z] = PLACES.scoreboard;
  const rotY = Math.atan2(0 - x, 6 - z); // 광장 중앙을 바라보도록
  return (
    <group position={PLACES.scoreboard} rotation={[0, rotY, 0]}>
      {[-3, 3].map((px) => (
        <mesh key={px} position={[px, 2.5, -0.2]} material={mat('#5d6b7a')} castShadow>
          <boxGeometry args={[0.5, 5, 0.5]} />
        </mesh>
      ))}
      <mesh position={[0, 6.6, -0.2]} material={mat('#f6c445')} castShadow>
        <boxGeometry args={[8.6, 5.6, 0.6]} />
      </mesh>
      <mesh position={[0, 6.6, 0.11]}>
        <planeGeometry args={[8, 5]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <Label text="11월 11일 농업인의 날" width={5} height={0.9} bg="#e2574c" color="#ffffff" fontSize={0.5} position={[0, 9.9, 0]} />
    </group>
  );
}

// ── 마을 입구: 장승 + 현수막 ─────────────────────────
function Jangseung({ text, hat, face = '#c99a66', ...props }) {
  return (
    <group {...props}>
      <mesh position={[0, 2.3, 0]} material={mat(face)} castShadow>
        <cylinderGeometry args={[0.55, 0.65, 4.6, 8]} />
      </mesh>
      {/* 얼굴 */}
      <group position={[0, 3.7, 0.5]}>
        {[-0.22, 0.22].map((x) => (
          <mesh key={x} position={[x, 0.1, 0.05]} material={mat('#ffffff')}>
            <sphereGeometry args={[0.16, 8, 8]} />
          </mesh>
        ))}
        {[-0.22, 0.22].map((x) => (
          <mesh key={`p${x}`} position={[x, 0.1, 0.19]} material={mat('#1d1d1d')}>
            <sphereGeometry args={[0.07, 6, 6]} />
          </mesh>
        ))}
        <mesh position={[0, -0.15, 0.12]} material={mat('#b5814f')}>
          <coneGeometry args={[0.12, 0.3, 5]} />
        </mesh>
        <mesh position={[0, -0.45, 0.08]} material={mat('#e84a3f')}>
          <boxGeometry args={[0.5, 0.12, 0.1]} />
        </mesh>
      </group>
      <mesh position={[0, 4.75, 0]} material={mat(hat)} castShadow>
        <cylinderGeometry args={[0.45, 0.7, 0.6, 8]} />
      </mesh>
      <Label text={text} width={0.55} height={2.2} bg="#f5e6c8" color="#5a3a1a" fontSize={0.4} position={[0, 1.7, 0.62]} />
    </group>
  );
}

export function Gate() {
  const banner = useRef();
  useFrame((state) => {
    if (banner.current) banner.current.rotation.x = Math.sin(state.clock.elapsedTime * 1.8) * 0.06;
  });
  return (
    <group position={PLACES.gate}>
      <Jangseung text={'천\n하\n대\n장\n군'} hat="#2f2f2f" position={[-4, 0, 0]} rotation={[0, Math.PI, 0]} />
      <Jangseung text={'지\n하\n여\n장\n군'} hat="#3b7dd8" face="#d9a877" position={[4, 0, 0]} rotation={[0, Math.PI, 0]} />
      {/* 현수막 기둥 */}
      {[-6.2, 6.2].map((x) => (
        <mesh key={x} position={[x, 3.6, 0]} material={mat(PALETTE.wood)} castShadow>
          <cylinderGeometry args={[0.18, 0.2, 7.2, 6]} />
        </mesh>
      ))}
      <group ref={banner} position={[0, 6.1, 0]}>
        <Label
          text="🌾 11월 11일 농업인의 날 축제! 🌾"
          width={11.6}
          height={1.6}
          bg="#e2574c"
          color="#fff8e0"
          border="#ffd34d"
          fontSize={0.72}
          rotation={[0, Math.PI, 0]}
        />
        <Label text="가래떡 마을에 오신 것을 환영해요!" width={11.6} height={1.6} bg="#e2574c" color="#fff8e0" border="#ffd34d" fontSize={0.66} position={[0, 0, -0.02]} />
      </group>
      {/* 깃발 장식 */}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[-5 + i * 1.25, 7.1, 0]} rotation={[0, 0, Math.PI]} material={mat(OBANG[i % 4] === '#ffffff' ? '#7dc96f' : OBANG[i % 4], { side: THREE.DoubleSide })}>
          <coneGeometry args={[0.3, 0.6, 3]} />
        </mesh>
      ))}
    </group>
  );
}

// ── 집 ───────────────────────────────────────────────
export function House({ wall = '#fff4d6', roof = PALETTE.roofRed, ...props }) {
  return (
    <group {...props}>
      <mesh position={[0, 1.6, 0]} material={mat(wall)} castShadow receiveShadow>
        <boxGeometry args={[7, 3.2, 6]} />
      </mesh>
      <mesh position={[0, 4.3, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1.45, 1, 1.25]} material={mat(roof)} castShadow>
        <coneGeometry args={[4.4, 2.4, 4]} />
      </mesh>
      <mesh position={[0, 1.1, 3.01]} material={mat(PALETTE.woodDark)}>
        <boxGeometry args={[1.3, 2.2, 0.1]} />
      </mesh>
      {[-2.2, 2.2].map((x) => (
        <mesh key={x} position={[x, 1.9, 3.01]} material={mat('#9fdcff', { emissive: '#9fdcff', emissiveIntensity: 0.2 })}>
          <boxGeometry args={[1.1, 1, 0.1]} />
        </mesh>
      ))}
      <mesh position={[2, 4.6, -1]} material={mat('#b5814f')} castShadow>
        <boxGeometry args={[0.6, 1.6, 0.6]} />
      </mesh>
    </group>
  );
}

export function Houses() {
  return (
    <>
      <House position={[-34, 0, 28.5]} rotation={[0, Math.PI / 2, 0]} />
      <House position={[-16, 0, 33.5]} wall="#ffe6d6" roof={PALETTE.roofBlue} rotation={[0, Math.PI, 0]} />
      <House position={[38, 0, 27.5]} wall="#e6ffd6" roof="#ff9f43" rotation={[0, -Math.PI / 2, 0]} />
    </>
  );
}

// ── 빨랫줄 ───────────────────────────────────────────
export function Clothesline() {
  const [x, , z] = PLACES.clothesline;
  const clothes = [
    { x: -2.6, c: '#ff9aa2', w: 0.9, h: 1.1 },
    { x: -1.3, c: '#9fdcff', w: 0.7, h: 0.8 },
    { x: 1.3, c: '#ffd166', w: 1, h: 0.7 },
    { x: 2.6, c: '#c3f0ca', w: 0.8, h: 1.2 },
  ];
  return (
    <group position={[x, 0, z]}>
      {[-3.4, 3.4].map((px) => (
        <mesh key={px} position={[px, 1.2, 0]} material={mat(PALETTE.wood)} castShadow>
          <cylinderGeometry args={[0.08, 0.1, 2.4, 6]} />
        </mesh>
      ))}
      <mesh position={[0, 2.25, 0]} rotation={[0, 0, Math.PI / 2]} material={mat('#f5f5f5')}>
        <cylinderGeometry args={[0.02, 0.02, 6.8, 4]} />
      </mesh>
      {clothes.map((c) => (
        <mesh key={c.x} position={[c.x, 2.2 - c.h / 2, 0]} material={mat(c.c, { side: THREE.DoubleSide })} castShadow>
          <boxGeometry args={[c.w, c.h, 0.04]} />
        </mesh>
      ))}
    </group>
  );
}
export { OBANG };
