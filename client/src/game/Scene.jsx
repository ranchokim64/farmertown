import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGame } from '../store.js';
import { MAIN_QUESTS } from './data/quests.js';
import { PLACES, WEEDY_PADDIES } from './data/world.js';
import { player } from './runtime.js';
import { Sky, Clouds, Ground, RiceFields, Weeds, Trees, Mountains, HayBales } from './models/Environment.jsx';
import { Fountain, Tablet, DangsanTree, Scoreboard, Gate, Houses, Clothesline } from './models/Village.jsx';
import { Mill, Market, Greenhouse, Shed, FieldLife, QuestMark } from './models/Workplaces.jsx';
import { Sparrow, Frog } from './models/Characters.jsx';
import { Player } from './Player.jsx';
import { CameraRig } from './CameraRig.jsx';
import { InteractionSystem } from './Interaction.jsx';
import { Pickups } from './Pickups.jsx';
import { Fireworks } from './effects/Fireworks.jsx';
import { CamBlock } from './CamBlock.jsx';

// 태양광: 그림자 범위를 줄이기 위해 플레이어(또는 카메라 시선)를 따라다닙니다.
function SunLight() {
  const light = useRef();
  useFrame(({ camera }) => {
    const l = light.current;
    if (!l) return;
    const phase = useGame.getState().phase;
    const cx = phase === 'play' ? player.pos.x : camera.position.x;
    const cz = phase === 'play' ? player.pos.z : camera.position.z - 20;
    l.position.set(cx + 30, 55, cz + 25);
    l.target.position.set(cx, 0, cz);
    l.target.updateMatrixWorld();
  });
  return (
    <directionalLight
      ref={light}
      intensity={2.1}
      color="#fff1d6"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-45}
      shadow-camera-right={45}
      shadow-camera-top={45}
      shadow-camera-bottom={-45}
      shadow-camera-far={150}
      shadow-bias={-0.0005}
      shadow-normalBias={0.04}
    />
  );
}

function LeaderboardPoller() {
  const refresh = useGame((s) => s.refreshLeaderboard);
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);
  return null;
}

export function Scene() {
  const progress = useGame((s) => s.progress);
  const leaderboard = useGame((s) => s.leaderboard);
  const schoolCode = useGame((s) => s.profile?.school?.code);
  const { flags, completed } = progress;
  const ribbons = MAIN_QUESTS.filter((q) => completed.includes(q)).length;

  return (
    <>
      <color attach="background" args={['#9fdcff']} />
      <fog attach="fog" args={['#dff3ff', 100, 480]} />
      <hemisphereLight args={['#cfeeff', '#d8b77e', 1.1]} />
      <ambientLight intensity={0.35} />
      <SunLight />

      <Sky />
      <Clouds />
      <Mountains />
      <Ground />
      <RiceFields />
      {WEEDY_PADDIES.map((w) => (
        <Weeds key={w.id} x={w.x} z={w.z} cleared={!!flags[w.id]} />
      ))}
      <CamBlock>
        <Trees />
      </CamBlock>
      <HayBales />

      <CamBlock>
        <Fountain />
      </CamBlock>
      <Tablet solved={completed.includes('soil')} />
      <CamBlock>
        <DangsanTree ribbons={completed.includes('final') ? 5 : ribbons} glowing={completed.includes('final')} />
      </CamBlock>
      {ribbons === 5 && !completed.includes('final') && <QuestMark position={[PLACES.dangsan[0], 12.5, PLACES.dangsan[2]]} text="🎀" />}
      {/* 카메라가 뚫고 들어가지 않도록 등록하는 건물/구조물 (온실 유리는 투명이라 제외) */}
      <CamBlock>
        <Scoreboard leaderboard={leaderboard} mySchoolCode={schoolCode} />
        <Gate />
        <Houses />
        <Mill />
        <Market flags={flags} />
        <Shed />
      </CamBlock>
      <Clothesline />
      <Greenhouse fixed={completed.includes('smartfarm')} />
      <FieldLife flags={flags} completed={completed} />

      <Sparrow position={PLACES.sparrowGuide} rotation={[0, 0.8, 0]} color="#c98a4b" />
      <Frog position={PLACES.frog} rotation={[0, Math.PI / 2, 0]} />

      <Pickups />
      <Player />
      <InteractionSystem />
      <CameraRig />
      <Fireworks />
      <LeaderboardPoller />
    </>
  );
}
