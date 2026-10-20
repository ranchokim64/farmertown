import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGame } from '../store.js';
import { player, cam } from './runtime.js';
import { getCameraTurn } from './input.js';
import { getBlockers } from './CamBlock.jsx';
import { sfx } from '../sfx.js';

export const introCtl = { skip: false, progress: 0, forceT: null };
const INTRO_SECONDS = 11;

// 인트로 카메라 경로: 구름 위 → 구름 통과 → 황금 들판 저공비행 → 장승/현수막 통과 → 캐릭터 등 뒤
const INTRO_POINTS = [
  [0, 98, 300],
  [0, 88, 245],
  [0, 74, 195], // 큰 구름 통과
  [0, 50, 165],
  [0, 22, 135],
  [3, 9, 110],
  [-2, 6, 85],
  [0, 4.8, 62],
  [0, 3.8, 46], // 마을 입구 현수막 아래
  [0, 3.6, 30],
];
// 같은 진행도에서 카메라가 바라보는 지점
const LOOK_POINTS = [
  [0, 96, 200],
  [0, 82, 160],
  [0, 50, 130],
  [0, 14, 105],
  [0, 3, 85],
  [0, 2, 65],
  [0, 2.5, 45],
  [0, 3.5, 30],
  [0, 3, 18],
  [0, 1.6, 10],
];
function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function CameraRig() {
  const { camera, gl } = useThree();
  const phase = useGame((s) => s.phase);
  const t = useRef(0);
  const look = useMemo(() => new THREE.Vector3(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const head = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const high = useMemo(() => new THREE.Vector3(), []);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const reach = useRef(1); // 장애물 때문에 줄어든 카메라 거리 비율 (0~1)

  const [curve, lookCurve] = useMemo(() => {
    const end = new THREE.Vector3(player.pos.x + Math.sin(cam.yaw) * cam.dist, cam.height, player.pos.z + Math.cos(cam.yaw) * cam.dist);
    const pts = INTRO_POINTS.map((p) => new THREE.Vector3(...p));
    pts.push(end);
    const looks = LOOK_POINTS.map((p) => new THREE.Vector3(...p));
    looks.push(new THREE.Vector3(player.pos.x, 1.3, player.pos.z));
    return [new THREE.CatmullRomCurve3(pts, false, 'centripetal'), new THREE.CatmullRomCurve3(looks, false, 'centripetal')];
  }, []);

  useEffect(() => {
    t.current = 0;
    introCtl.skip = false;
    introCtl.progress = 0;
    if (phase === 'intro') sfx.play('whoosh');
  }, [phase]);

  // 마우스/터치 드래그로 시점 회전
  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let lastX = 0;
    const down = (e) => {
      if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.45) return; // 왼쪽은 조이스틱 영역
      dragging = true;
      lastX = e.clientX;
    };
    const move = (e) => {
      if (!dragging) return;
      cam.yaw -= (e.clientX - lastX) * 0.006;
      lastX = e.clientX;
    };
    const up = () => (dragging = false);
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [gl]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    t.current += dt;
    if (window.__ft && !window.__ft.camera) window.__ft.camera = camera; // ?debug 전용

    if (phase === 'title') {
      // 타이틀: 황금 들판 위를 천천히 선회
      const a = t.current * 0.06;
      camera.position.set(Math.sin(a) * 34, 11 + Math.sin(a * 2) * 2, 86 + Math.cos(a) * 30);
      camera.lookAt(0, 1, 86);
      return;
    }

    if (phase === 'intro') {
      const prevRaw = introCtl.progress;
      const raw = introCtl.forceT ?? Math.min(t.current / INTRO_SECONDS, 1);
      if (prevRaw < 0.42 && raw >= 0.42) sfx.play('whoosh'); // 들판 저공비행 시작
      introCtl.progress = raw;
      const u = easeInOut(raw);
      curve.getPoint(u, camera.position);
      lookCurve.getPoint(u, look);
      camera.lookAt(look);
      // 구름 통과 시 화면이 하얗게
      const flash = document.getElementById('intro-flash');
      if (flash) {
        const f = Math.max(0, 1 - Math.abs(u - 0.2) / 0.07);
        flash.style.opacity = String(f);
      }
      if (raw >= 1 || introCtl.skip) {
        if (flash) flash.style.opacity = '0';
        useGame.getState().setPhase('play');
      }
      return;
    }

    // 플레이: 3인칭 추적 카메라
    cam.yaw += getCameraTurn() * dt * 1.8;
    tmp.set(player.pos.x + Math.sin(cam.yaw) * cam.dist, cam.height, player.pos.z + Math.cos(cam.yaw) * cam.dist);

    // 벽 충돌: 머리 → 카메라 방향으로 레이를 쏴서 건물/나무에 가리면 카메라를 앞으로 당김.
    // 막혔을 때는 위에서 내려다보는 자리도 시험해 더 멀리 보이는 쪽을 고릅니다.
    head.set(player.pos.x, 1.5, player.pos.z);
    const free = (target) => {
      dir.subVectors(target, head);
      const full = dir.length();
      dir.divideScalar(full);
      ray.set(head, dir);
      ray.far = full;
      const hit = ray.intersectObjects(getBlockers(), false)[0];
      return hit ? Math.max(0, hit.distance - 0.35) / full : 1;
    };
    let want = free(tmp);
    if (want < 1) {
      high.set(player.pos.x + Math.sin(cam.yaw) * cam.dist * 0.6, cam.height + 3.5, player.pos.z + Math.cos(cam.yaw) * cam.dist * 0.6);
      const wantHigh = free(high);
      if (wantHigh * high.distanceTo(head) > want * tmp.distanceTo(head)) {
        tmp.copy(high);
        want = wantHigh;
      }
    }
    if (want < reach.current) reach.current = want; // 가릴 때는 즉시
    else reach.current = THREE.MathUtils.damp(reach.current, want, 3, dt); // 풀릴 때는 부드럽게
    dir.subVectors(tmp, head);
    const allowed = dir.length() * reach.current;
    tmp.copy(head).addScaledVector(dir.normalize(), allowed);
    player.hidden = allowed < 1.4; // 카메라가 아주 가까우면 캐릭터가 화면을 가리지 않게 숨김

    if (camera.position.distanceTo(tmp) > 25) camera.position.copy(tmp); // 이어하기/건너뛰기 직후 바로 안착
    else camera.position.lerp(tmp, 1 - Math.exp(-dt * 8));
    // 따라가는 중에도 벽 너머로 빠지지 않도록 거리 제한
    dir.subVectors(camera.position, head);
    if (dir.length() > allowed + 0.05) camera.position.copy(head).addScaledVector(dir.normalize(), allowed);
    camera.lookAt(player.pos.x, 1.3, player.pos.z);
  });

  return null;
}
