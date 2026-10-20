import * as THREE from 'three';
import { PLAYER_START } from './data/world.js';

// 매 프레임 바뀌는 값은 React 상태 대신 가변 객체에 둡니다 (리렌더 방지).
export const player = {
  pos: new THREE.Vector3(PLAYER_START.x, 0, PLAYER_START.z),
  heading: PLAYER_START.heading, // 캐릭터가 바라보는 방향 (0 = +z)
  speed: 0,
};

export const cam = {
  yaw: 0, // 카메라가 플레이어 주위를 도는 각도 (0 = 플레이어 남쪽(+z)에서 북쪽을 봄)
  dist: 7,
  height: 3.6,
};

export function resetPlayer() {
  player.pos.set(PLAYER_START.x, 0, PLAYER_START.z);
  player.heading = PLAYER_START.heading;
  player.speed = 0;
  cam.yaw = 0;
}
