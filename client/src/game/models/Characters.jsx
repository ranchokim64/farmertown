import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { mat, PALETTE } from '../materials.js';

// 2~3등신 꼬마 농부 / 마을 주민
// motion: { speed } 가변 객체를 넘기면 걷기 애니메이션을 합니다.
export function Villager({
  overall = '#4a90e2',
  shirt = '#fff4d6',
  skin = PALETTE.skin,
  hat = 'straw', // 'straw' | 'none' | 'scarf'
  hair = '#4a2f1d',
  hatBand = '#e2574c',
  beard = false,
  motion,
  idle = true,
  ...props
}) {
  const body = useRef();
  const legL = useRef();
  const legR = useRef();
  const armL = useRef();
  const armR = useRef();
  const phase = useRef(Math.random() * 10);

  useFrame((_, dt) => {
    const speed = motion?.speed ?? 0;
    phase.current += dt * (speed > 0.1 ? 4 + speed * 1.4 : 2);
    const p = phase.current;
    const walk = Math.min(speed / 5, 1);
    const swing = Math.sin(p) * 0.8 * walk;
    if (legL.current) {
      legL.current.rotation.x = swing;
      legR.current.rotation.x = -swing;
      armL.current.rotation.x = -swing * 0.9;
      armR.current.rotation.x = swing * 0.9;
    }
    if (body.current) {
      const bob = walk > 0.05 ? Math.abs(Math.sin(p)) * 0.12 * walk : idle ? Math.sin(p) * 0.025 : 0;
      body.current.position.y = bob;
    }
  });

  const skinM = mat(skin);
  return (
    <group {...props}>
      <group ref={body}>
        {/* 다리 */}
        <group ref={legL} position={[-0.18, 0.45, 0]}>
          <mesh position={[0, -0.2, 0]} material={mat(overall)} castShadow>
            <cylinderGeometry args={[0.13, 0.12, 0.42, 7]} />
          </mesh>
          <mesh position={[0, -0.4, 0.05]} material={mat('#6b4428')} castShadow>
            <boxGeometry args={[0.24, 0.12, 0.32]} />
          </mesh>
        </group>
        <group ref={legR} position={[0.18, 0.45, 0]}>
          <mesh position={[0, -0.2, 0]} material={mat(overall)} castShadow>
            <cylinderGeometry args={[0.13, 0.12, 0.42, 7]} />
          </mesh>
          <mesh position={[0, -0.4, 0.05]} material={mat('#6b4428')} castShadow>
            <boxGeometry args={[0.24, 0.12, 0.32]} />
          </mesh>
        </group>
        {/* 몸통: 셔츠 + 오버올 */}
        <mesh position={[0, 0.78, 0]} material={mat(shirt)} castShadow>
          <capsuleGeometry args={[0.34, 0.3, 4, 10]} />
        </mesh>
        <mesh position={[0, 0.68, 0.005]} material={mat(overall)} castShadow>
          <cylinderGeometry args={[0.37, 0.39, 0.42, 10]} />
        </mesh>
        <mesh position={[0, 0.92, 0.27]} material={mat(overall)}>
          <boxGeometry args={[0.36, 0.26, 0.1]} />
        </mesh>
        <mesh position={[-0.13, 0.97, 0.33]} material={mat('#ffd34d')}>
          <sphereGeometry args={[0.04, 6, 6]} />
        </mesh>
        <mesh position={[0.13, 0.97, 0.33]} material={mat('#ffd34d')}>
          <sphereGeometry args={[0.04, 6, 6]} />
        </mesh>
        {/* 팔 */}
        <group ref={armL} position={[-0.42, 1.0, 0]}>
          <mesh position={[-0.04, -0.2, 0]} rotation={[0, 0, -0.15]} material={mat(shirt)} castShadow>
            <capsuleGeometry args={[0.09, 0.28, 3, 6]} />
          </mesh>
          <mesh position={[-0.08, -0.42, 0]} material={skinM}>
            <sphereGeometry args={[0.1, 7, 6]} />
          </mesh>
        </group>
        <group ref={armR} position={[0.42, 1.0, 0]}>
          <mesh position={[0.04, -0.2, 0]} rotation={[0, 0, 0.15]} material={mat(shirt)} castShadow>
            <capsuleGeometry args={[0.09, 0.28, 3, 6]} />
          </mesh>
          <mesh position={[0.08, -0.42, 0]} material={skinM}>
            <sphereGeometry args={[0.1, 7, 6]} />
          </mesh>
        </group>
        {/* 머리 */}
        <group position={[0, 1.62, 0]}>
          <mesh material={skinM} castShadow>
            <sphereGeometry args={[0.52, 14, 12]} />
          </mesh>
          {/* 머리카락 */}
          <mesh position={[0, 0.1, -0.06]} scale={[1.02, 0.9, 1]} material={mat(hair)}>
            <sphereGeometry args={[0.53, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          </mesh>
          {/* 눈, 볼 */}
          <mesh position={[-0.18, 0.02, 0.47]} material={mat('#2b2018')}>
            <sphereGeometry args={[0.065, 8, 8]} />
          </mesh>
          <mesh position={[0.18, 0.02, 0.47]} material={mat('#2b2018')}>
            <sphereGeometry args={[0.065, 8, 8]} />
          </mesh>
          <mesh position={[-0.16, 0.05, 0.53]} material={mat('#ffffff')}>
            <sphereGeometry args={[0.02, 6, 6]} />
          </mesh>
          <mesh position={[0.2, 0.05, 0.53]} material={mat('#ffffff')}>
            <sphereGeometry args={[0.02, 6, 6]} />
          </mesh>
          <mesh position={[-0.3, -0.12, 0.4]} scale={[1, 0.6, 0.4]} material={mat('#ff9aa2')}>
            <sphereGeometry args={[0.08, 8, 6]} />
          </mesh>
          <mesh position={[0.3, -0.12, 0.4]} scale={[1, 0.6, 0.4]} material={mat('#ff9aa2')}>
            <sphereGeometry args={[0.08, 8, 6]} />
          </mesh>
          <mesh position={[0, -0.16, 0.49]} rotation={[0, 0, Math.PI]} material={mat('#c0504d')}>
            <torusGeometry args={[0.06, 0.018, 4, 8, Math.PI]} />
          </mesh>
          {beard && (
            <mesh position={[0, -0.32, 0.36]} scale={[1, 0.8, 0.6]} material={mat('#f2f2f2')}>
              <sphereGeometry args={[0.22, 8, 6]} />
            </mesh>
          )}
          {hat === 'straw' && <StrawHat band={hatBand} position={[0, 0.3, 0]} />}
          {hat === 'scarf' && (
            <mesh position={[0, 0.18, -0.02]} scale={[1.08, 0.75, 1.08]} material={mat(hatBand)}>
              <sphereGeometry args={[0.53, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            </mesh>
          )}
        </group>
      </group>
      {/* 발밑 그림자 보조 */}
    </group>
  );
}

export function StrawHat({ band = '#e2574c', ...props }) {
  return (
    <group {...props}>
      <mesh material={mat('#f3d27a')} castShadow>
        <cylinderGeometry args={[0.85, 0.88, 0.05, 14]} />
      </mesh>
      <mesh position={[0, 0.17, 0]} material={mat('#f3d27a')} castShadow>
        <cylinderGeometry args={[0.38, 0.46, 0.32, 12]} />
      </mesh>
      <mesh position={[0, 0.07, 0]} material={mat(band)}>
        <cylinderGeometry args={[0.465, 0.47, 0.09, 12]} />
      </mesh>
    </group>
  );
}

export function Sparrow({ color = '#a8743f', hop = true, ...props }) {
  const ref = useRef();
  const t0 = useRef(Math.random() * 10);
  useFrame((state) => {
    if (!hop || !ref.current) return;
    const t = state.clock.elapsedTime + t0.current;
    ref.current.position.y = Math.max(0, Math.sin(t * 5)) * 0.12;
    ref.current.rotation.x = Math.sin(t * 2.3) > 0.7 ? 0.5 : 0; // 콕콕 쪼기
  });
  return (
    <group {...props}>
      <group ref={ref}>
        <mesh position={[0, 0.22, 0]} scale={[1, 0.9, 1.2]} material={mat(color)} castShadow>
          <icosahedronGeometry args={[0.2, 1]} />
        </mesh>
        <mesh position={[0, 0.2, 0.05]} scale={[0.8, 0.7, 1]} material={mat('#f6e7cf')}>
          <icosahedronGeometry args={[0.17, 1]} />
        </mesh>
        <mesh position={[0, 0.4, 0.12]} material={mat(color)} castShadow>
          <icosahedronGeometry args={[0.14, 1]} />
        </mesh>
        <mesh position={[0, 0.39, 0.27]} rotation={[Math.PI / 2, 0, 0]} material={mat('#f2a33a')}>
          <coneGeometry args={[0.04, 0.1, 4]} />
        </mesh>
        <mesh position={[-0.07, 0.43, 0.23]} material={mat('#1d1d1d')}>
          <sphereGeometry args={[0.025, 6, 6]} />
        </mesh>
        <mesh position={[0.07, 0.43, 0.23]} material={mat('#1d1d1d')}>
          <sphereGeometry args={[0.025, 6, 6]} />
        </mesh>
        <mesh position={[0, 0.25, -0.26]} rotation={[0.6, 0, 0]} material={mat('#7a5233')}>
          <boxGeometry args={[0.14, 0.03, 0.2]} />
        </mesh>
      </group>
    </group>
  );
}

export function Snail({ shell = '#d98b4a', ...props }) {
  return (
    <group {...props}>
      <mesh position={[0, 0.08, 0.05]} scale={[0.7, 0.5, 1.6]} material={mat('#e8d3a8')} castShadow>
        <sphereGeometry args={[0.14, 8, 6]} />
      </mesh>
      <mesh position={[0, 0.22, -0.04]} material={mat(shell)} castShadow>
        <torusGeometry args={[0.1, 0.07, 6, 10]} />
      </mesh>
      <mesh position={[0, 0.22, -0.04]} material={mat('#b86b32')}>
        <sphereGeometry args={[0.07, 6, 6]} />
      </mesh>
      <mesh position={[-0.04, 0.2, 0.25]} rotation={[0.5, 0, 0]} material={mat('#e8d3a8')}>
        <cylinderGeometry args={[0.012, 0.012, 0.14, 4]} />
      </mesh>
      <mesh position={[0.04, 0.2, 0.25]} rotation={[0.5, 0, 0]} material={mat('#e8d3a8')}>
        <cylinderGeometry args={[0.012, 0.012, 0.14, 4]} />
      </mesh>
    </group>
  );
}

export function Frog(props) {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) ref.current.scale.y = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.04;
  });
  return (
    <group {...props}>
      <group ref={ref}>
        <mesh position={[0, 0.3, 0]} scale={[1.2, 0.8, 1]} material={mat('#6cc04a')} castShadow>
          <icosahedronGeometry args={[0.35, 1]} />
        </mesh>
        <mesh position={[0, 0.25, 0.12]} scale={[1, 0.6, 0.8]} material={mat('#e9f7c8')}>
          <icosahedronGeometry args={[0.28, 1]} />
        </mesh>
        {[-0.17, 0.17].map((x) => (
          <group key={x} position={[x, 0.55, 0.12]}>
            <mesh material={mat('#6cc04a')}>
              <sphereGeometry args={[0.12, 8, 8]} />
            </mesh>
            <mesh position={[0, 0.02, 0.09]} material={mat('#ffffff')}>
              <sphereGeometry args={[0.07, 8, 8]} />
            </mesh>
            <mesh position={[0, 0.02, 0.15]} material={mat('#1d1d1d')}>
              <sphereGeometry args={[0.04, 6, 6]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.34, 0.33]} rotation={[0, 0, Math.PI]} material={mat('#c0504d')}>
          <torusGeometry args={[0.1, 0.02, 4, 8, Math.PI]} />
        </mesh>
        {/* 연잎 방석 */}
        <mesh position={[0, 0.02, 0]} material={mat('#3f9b4f')} receiveShadow>
          <cylinderGeometry args={[0.6, 0.6, 0.04, 10, 1, false, 0.3, Math.PI * 1.8]} />
        </mesh>
      </group>
    </group>
  );
}
