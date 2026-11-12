import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGame, backoffMs } from '../store.js';
import { MAIN_QUESTS, questActive, questStarted } from './data/quests.js';
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
import { useQuality, QUALITY } from '../quality.js';
import { TutorialSystem, Chief, GiverMarks, YoungFarmer } from './Tutorial.jsx';

// 태양광: 그림자 범위를 줄이기 위해 플레이어(또는 카메라 시선)를 따라다닙니다.
function SunLight() {
  const light = useRef();
  const q = QUALITY[useQuality((s) => s.level)];
  // 그림자 해상도가 바뀌면 기존 그림자 맵을 버려 새 크기로 다시 만들게 함
  useEffect(() => {
    const l = light.current;
    if (!l?.shadow.map) return;
    l.shadow.map.dispose();
    l.shadow.map = null;
  }, [q.shadowSize]);
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
      castShadow={q.shadows}
      shadow-mapSize={[q.shadowSize, q.shadowSize]}
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

// 플레이 중 초당 프레임이 계속 낮으면(태블릿 등) 화질을 한 단계 자동으로 낮춤
function QualityMonitor() {
  const acc = useRef({ t: 0, frames: 0, warm: 0, slow: 0 });
  useFrame((_, dt) => {
    const a = acc.current;
    if (useGame.getState().phase !== 'play' || document.hidden || dt > 0.5) return;
    a.warm += dt;
    if (a.warm < 4) return; // 처음 몇 초는 로딩 중이라 제외
    a.t += dt;
    a.frames += 1;
    if (a.t < 4) return;
    const fps = a.frames / a.t;
    a.t = 0;
    a.frames = 0;
    a.slow = fps < 28 ? a.slow + 1 : 0;
    if (a.slow >= 2 && useQuality.getState().lower()) {
      a.slow = 0;
      a.warm = 0;
      useGame.getState().toast(`화면이 버벅여서 화질을 '${QUALITY[useQuality.getState().level].label}'(으)로 낮췄어요 (⚙ 버튼으로 바꿀 수 있어요)`);
    }
  });
  return null;
}

// 전광판 순위: 45초마다 (화면이 안 보이면 멈춤, 실패하면 간격을 늘림)
// 10초 폴링은 접속자 수에 비례해 서버를 두드려 2026-11-11 장애를 키웠음.
const POLL_MS = 45_000;
function LeaderboardPoller() {
  useEffect(() => {
    let timer = null;
    let fails = 0;
    let last = 0;
    const schedule = (ms) => {
      clearTimeout(timer);
      timer = setTimeout(tick, ms);
    };
    const tick = async () => {
      if (document.hidden) return; // 다시 보일 때 visibilitychange 에서 이어감
      last = Date.now();
      const ok = await useGame.getState().refreshLeaderboard();
      fails = ok ? 0 : fails + 1;
      schedule(ok ? POLL_MS * (0.9 + Math.random() * 0.2) : backoffMs(fails, POLL_MS));
    };
    const onVisible = () => {
      if (document.hidden) return clearTimeout(timer);
      schedule(Date.now() - last > POLL_MS ? Math.random() * 3000 : POLL_MS - (Date.now() - last));
    };
    document.addEventListener('visibilitychange', onVisible);
    schedule(Math.random() * 2000); // 동시에 켠 태블릿들이 한꺼번에 묻지 않도록
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
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
      {questActive(progress, 'final') && <QuestMark position={[PLACES.dangsan[0], 12.5, PLACES.dangsan[2]]} text="🎀" />}
      {/* 카메라가 뚫고 들어가지 않도록 등록하는 건물/구조물 (온실 유리는 투명이라 제외) */}
      <CamBlock>
        <Scoreboard leaderboard={leaderboard} mySchoolCode={schoolCode} />
        <Gate />
        <Houses />
        <Mill />
        <Market flags={flags} tteokStarted={questStarted(progress, 'tteok') && !completed.includes('tteok')} />
        <Shed />
      </CamBlock>
      <Clothesline />
      <Greenhouse fixed={completed.includes('smartfarm')} />
      <FieldLife flags={flags} completed={completed} snailActive={questActive(progress, 'snail')} scarecrowActive={questActive(progress, 'scarecrow')} />

      <Chief />
      <YoungFarmer />
      <GiverMarks />
      <TutorialSystem />
      <Sparrow position={PLACES.sparrowGuide} rotation={[0, 0.8, 0]} color="#c98a4b" />
      <Frog position={PLACES.frog} rotation={[0, Math.PI / 2, 0]} />

      <Pickups />
      <Player />
      <InteractionSystem />
      <CameraRig />
      <Fireworks />
      <LeaderboardPoller />
      <QualityMonitor />
    </>
  );
}
