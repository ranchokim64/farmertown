import { useLayoutEffect, useRef } from 'react';

// 카메라를 가리는 물체 목록. CameraRig 가 이 메시들만 레이캐스트합니다.
export const camBlockers = { meshes: new Set(), list: [], dirty: false };

export function getBlockers() {
  if (camBlockers.dirty) {
    camBlockers.list = [...camBlockers.meshes];
    camBlockers.dirty = false;
  }
  return camBlockers.list;
}

// 감싼 자식 메시들을 카메라 차단물로 등록합니다.
export function CamBlock({ children }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const added = [];
    ref.current.traverse((o) => {
      if (o.isMesh && !o.material?.transparent) {
        camBlockers.meshes.add(o);
        added.push(o);
      }
    });
    camBlockers.dirty = true;
    return () => {
      added.forEach((o) => camBlockers.meshes.delete(o));
      camBlockers.dirty = true;
    };
  }, []);
  return <group ref={ref}>{children}</group>;
}
