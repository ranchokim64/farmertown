// 키보드 + 터치 조이스틱 입력
const keys = new Set();
export const joystick = { x: 0, y: 0 }; // -1 ~ 1 (y: 위쪽이 -1)
const interactListeners = new Set();

export function onInteract(fn) {
  interactListeners.add(fn);
  return () => interactListeners.delete(fn);
}
export function fireInteract() {
  interactListeners.forEach((fn) => fn());
}

const isTyping = (e) => ['INPUT', 'TEXTAREA'].includes(e.target?.tagName);

window.addEventListener('keydown', (e) => {
  if (isTyping(e)) return;
  keys.add(e.code);
  if ((e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
    e.preventDefault();
    fireInteract();
  }
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

// 입력 방향 (카메라 기준): forward(+1 = 앞), right(+1 = 오른쪽)
export function getMoveInput() {
  let forward = 0;
  let right = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) forward += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) forward -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) right += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) right -= 1;
  forward += -joystick.y;
  right += joystick.x;
  const len = Math.hypot(forward, right);
  if (len > 1) {
    forward /= len;
    right /= len;
  }
  return { forward, right, run: keys.has('ShiftLeft') || keys.has('ShiftRight') };
}

export function getCameraTurn() {
  let t = 0;
  if (keys.has('KeyQ')) t += 1;
  if (keys.has('KeyR')) t -= 1;
  return t;
}
