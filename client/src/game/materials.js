import * as THREE from 'three';

// 색상별 재질 캐시 (로우폴리 느낌을 위해 flatShading)
const cache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!cache.has(key)) {
    cache.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0, ...opts }));
  }
  return cache.get(key);
}

export const PALETTE = {
  gold: '#f6c445',
  goldDeep: '#e9a825',
  sky: '#8fd3ff',
  wood: '#b07a4a',
  woodDark: '#7a5233',
  soil: '#9c6b43',
  grass: '#a9d46a',
  path: '#ecd3a0',
  stone: '#d9d2c5',
  roofRed: '#e2654f',
  roofBlue: '#5b8fd9',
  white: '#fffaf0',
  skin: '#ffd9b3',
};
