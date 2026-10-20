import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGame } from '../store.js';
import { PICKUPS, ITEMS } from './data/quests.js';
import { mat } from './materials.js';
import { Label } from './canvasText.jsx';
import { StrawHat } from './models/Characters.jsx';
import { Tteok, TTEOK_COLORS } from './models/Workplaces.jsx';

function HanjaTile({ char }) {
  return (
    <group>
      <mesh material={mat('#a9a296')} castShadow>
        <boxGeometry args={[0.8, 0.8, 0.2]} />
      </mesh>
      <Label text={char} width={0.7} height={0.7} bg="#cfc8bb" color="#3d2a14" fontSize={0.55} position={[0, 0, 0.11]} />
      <Label text={char} width={0.7} height={0.7} bg="#cfc8bb" color="#3d2a14" fontSize={0.55} position={[0, 0, -0.11]} rotation={[0, Math.PI, 0]} />
    </group>
  );
}

function Shirt() {
  return (
    <group>
      <mesh material={mat('#6b8e9e')} castShadow>
        <boxGeometry args={[0.7, 0.75, 0.2]} />
      </mesh>
      <mesh position={[0, 0.25, 0]} material={mat('#6b8e9e')} castShadow>
        <boxGeometry args={[1.2, 0.25, 0.2]} />
      </mesh>
      {[-0.2, 0.2].map((x) => (
        <mesh key={x} position={[x, -0.1, 0.11]} material={mat('#e2574c')}>
          <boxGeometry args={[0.15, 0.15, 0.02]} />
        </mesh>
      ))}
    </group>
  );
}

function Sensor() {
  return (
    <group>
      <mesh material={mat('#f5f5f5')} castShadow>
        <boxGeometry args={[0.5, 0.36, 0.24]} />
      </mesh>
      <mesh position={[0, 0.02, 0.125]}>
        <planeGeometry args={[0.36, 0.2]} />
        <meshBasicMaterial color="#3cff8a" />
      </mesh>
      <mesh position={[0.17, 0.32, 0]} material={mat('#5d6b7a')}>
        <cylinderGeometry args={[0.02, 0.02, 0.35, 4]} />
      </mesh>
      <mesh position={[0.17, 0.5, 0]} material={mat('#e2574c')}>
        <sphereGeometry args={[0.05, 6, 6]} />
      </mesh>
    </group>
  );
}

function ItemModel({ id }) {
  if (id.startsWith('hanja')) return <HanjaTile char={ITEMS[id].icon} />;
  if (id === 'straw_hat') return <StrawHat scale={0.7} />;
  if (id === 'old_shirt') return <Shirt />;
  if (id === 'sensor') return <Sensor />;
  if (TTEOK_COLORS[id]) return <Tteok color={TTEOK_COLORS[id]} scale={0.8} />;
  return null;
}

function Pickup({ item, index }) {
  const spin = useRef();
  const onGround = item.pos[1] === 0;
  useFrame((state) => {
    if (!spin.current) return;
    const t = state.clock.elapsedTime + index;
    spin.current.rotation.y = t * 1.2;
    spin.current.position.y = (onGround ? 0.9 : 0.25) + Math.sin(t * 2.5) * 0.12;
  });
  return (
    <group position={item.pos}>
      <group ref={spin}>
        <ItemModel id={item.id} />
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.55, 0.75, 24]} />
        <meshBasicMaterial color="#fff59d" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

export function Pickups() {
  const flags = useGame((s) => s.progress.flags);
  return PICKUPS.filter((it) => !flags[it.id]).map((it) => <Pickup key={it.id} item={it} index={PICKUPS.indexOf(it)} />);
}
