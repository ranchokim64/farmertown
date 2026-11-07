// 전체 화면: 태블릿 브라우저의 주소창을 숨겨 게임 화면을 넓게 씀 (사용자 터치 안에서만 호출 가능)
export const canFullscreen = typeof document !== 'undefined' && !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);

export const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

export async function enterFullscreen() {
  if (!canFullscreen || isFullscreen()) return;
  const el = document.documentElement;
  try {
    await (el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.());
  } catch {
    /* 거부되면 그냥 진행 */
  }
}

export async function toggleFullscreen() {
  if (isFullscreen()) {
    try {
      await (document.exitFullscreen?.() ?? document.webkitExitFullscreen?.());
    } catch {
      /* 무시 */
    }
  } else {
    await enterFullscreen();
  }
}
