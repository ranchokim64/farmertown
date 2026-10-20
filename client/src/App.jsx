import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from './store.js';
import { Scene } from './game/Scene.jsx';
import { TitleScreen } from './ui/TitleScreen.jsx';
import { HUD } from './ui/HUD.jsx';
import { ClearScreen } from './ui/ClearScreen.jsx';
import { introCtl } from './game/CameraRig.jsx';
import { music } from './music.js';
import { SoundToggles } from './ui/SoundToggles.jsx';

export default function App() {
  const phase = useGame((s) => s.phase);
  const showClear = useGame((s) => s.showClear);
  const cleared = useGame((s) => s.progress.completed.includes('final'));

  // 장면에 맞춰 배경음악 전환
  useEffect(() => {
    music.play(phase === 'play' ? (cleared ? 'festival' : 'village') : 'title');
  }, [phase, cleared]);

  return (
    <div className="app">
      <div className={`stage ${phase === 'title' ? 'blurred' : ''}`}>
        <Canvas
          shadows={{ type: THREE.PCFSoftShadowMap }}
          dpr={[1, 1.5]}
          camera={{ fov: 55, near: 0.1, far: 2000, position: [0, 12, 110] }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
          }}
        >
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        </Canvas>
      </div>
      <div id="intro-flash" className="flash" />

      {phase === 'title' && <TitleScreen />}
      {phase !== 'play' && (
        <div className="title-sound">
          <SoundToggles />
        </div>
      )}
      {phase === 'intro' && (
        <button className="skip-btn" onClick={() => (introCtl.skip = true)}>
          건너뛰기 ⏭
        </button>
      )}
      {phase === 'play' && <HUD />}
      {showClear && <ClearScreen />}
    </div>
  );
}
