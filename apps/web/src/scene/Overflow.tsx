import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D } from 'three';
import { useLabStore } from '../store/labStore';
import { useSceneStore } from './sceneStore';
import { TANK } from './layout';

/** การเคลื่อนไหวใช้ simTimeS เท่านั้น จึงค้างอยู่ตำแหน่งเดิมเมื่อ Pause */
export function Overflow() {
  const active = useLabStore((s) => !!s.snapshot?.commands.refillPump && (s.snapshot?.tank.overflowFlowLpm ?? 0) > 0);
  const low = useSceneStore((s) => s.lowGraphics);
  const count = low ? 12 : 28;
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useFrame(() => {
    const snap = useLabStore.getState().snapshot;
    if (!snap || !mesh.current || !active) return;
    const strength = Math.min(1, (snap.tank.overflowFlowLpm ?? 0) / 2);
    for (let i = 0; i < count; i++) {
      const t = (snap.simTimeS * 1.4 + i / count) % 1;
      dummy.position.set(-0.09 + (i % 5) * 0.018, TANK.height - t * t * 0.38, TANK.depth / 2 + 0.025 + t * 0.015);
      dummy.scale.setScalar(0.0018 + strength * 0.0012);
      dummy.scale.y *= 1.5 + t;
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return <group visible={active}>
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false} raycast={() => null}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshStandardMaterial color="#9de1fa" transparent opacity={0.7} roughness={0.18} depthWrite={false} />
    </instancedMesh>
  </group>;
}
