import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, MathUtils, Object3D, Path, Shape, type Mesh } from 'three';
import { useLabStore } from '../store/labStore';
import { LID, POT, TANK, cm, potPosition } from './layout';
import { useSceneStore } from './sceneStore';

const AIR_STONES: [number, number][] = [
  [-0.12, 0],
  [0.12, 0],
];

function Walls() {
  const mode = useSceneStore((s) => s.tankMode);
  const { width: w, depth: d, height: h, wall: t } = TANK;
  const transparent = mode !== 'opaque';
  const material = (
    <meshStandardMaterial
      color={transparent ? '#dbeafe' : '#f8fafc'}
      transparent={transparent}
      opacity={transparent ? 0.18 : 1}
      roughness={transparent ? 0.1 : 0.7}
      depthWrite={!transparent}
    />
  );
  return (
    <group>
      <mesh position={[0, -t / 2, 0]} receiveShadow>
        <boxGeometry args={[w + 2 * t, t, d + 2 * t]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
      </mesh>
      <mesh position={[-(w + t) / 2, h / 2, 0]}>
        <boxGeometry args={[t, h, d + 2 * t]} />
        {material}
      </mesh>
      <mesh position={[(w + t) / 2, h / 2, 0]}>
        <boxGeometry args={[t, h, d + 2 * t]} />
        {material}
      </mesh>
      <mesh position={[0, h / 2, -(d + t) / 2]}>
        <boxGeometry args={[w, h, t]} />
        {material}
      </mesh>
      {mode !== 'cutaway' && (
        <mesh position={[0, h / 2, (d + t) / 2]}>
          <boxGeometry args={[w, h, t]} />
          {material}
        </mesh>
      )}
      {/* ขีดบอกระดับ 25/50/75% บนผนังหลัง */}
      {[0.25, 0.5, 0.75].map((f) => (
        <mesh key={f} position={[-w / 2 + 0.03, h * f, -d / 2 + 0.001]}>
          <planeGeometry args={[0.04, 0.0015]} />
          <meshBasicMaterial color="#64748b" />
        </mesh>
      ))}
    </group>
  );
}

function Lid({ count }: { count: number }) {
  const mode = useSceneStore((s) => s.tankMode);
  const geometry = useMemo(() => {
    const W = TANK.width + 2 * (TANK.wall + LID.overhang);
    const D = TANK.depth + 2 * (TANK.wall + LID.overhang);
    const shape = new Shape();
    shape.moveTo(-W / 2, -D / 2);
    shape.lineTo(W / 2, -D / 2);
    shape.lineTo(W / 2, D / 2);
    shape.lineTo(-W / 2, D / 2);
    shape.closePath();
    for (let i = 0; i < count; i++) {
      const [x, z] = potPosition(i, count);
      const hole = new Path();
      // Shape อยู่บนระนาบ XY แล้วหมุนเป็น XZ: y ของ Shape = −z ของโลก
      hole.absarc(x, -z, POT.holeRadius, 0, Math.PI * 2, false);
      shape.holes.push(hole);
    }
    return { shape, depth: LID.thickness };
  }, [count]);

  return (
    <mesh position={[0, TANK.height, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <extrudeGeometry args={[geometry.shape, { depth: geometry.depth, bevelEnabled: false }]} />
      <meshStandardMaterial
        color="#334155"
        roughness={0.85}
        transparent={mode === 'cutaway'}
        opacity={mode === 'cutaway' ? 0.45 : 1}
      />
    </mesh>
  );
}

/** น้ำในถัง — ความสูงตาม Water height จริงจาก Simulation */
function Water() {
  const body = useRef<Mesh>(null);
  const surface = useRef<Mesh>(null);
  const level = useRef<number | null>(null);
  useFrame((_, dt) => {
    const tank = useLabStore.getState().snapshot?.tank;
    if (!tank || !body.current || !surface.current) return;
    const targetH = cm(tank.waterHeightCm);
    level.current = level.current === null ? targetH : MathUtils.damp(level.current, targetH, 4, Math.min(dt, 0.1));
    const h = Math.max(0.0008, level.current);
    body.current.scale.y = h;
    body.current.position.y = h / 2;
    surface.current.position.y = h;
    body.current.visible = surface.current.visible = level.current > 0.0005;
  });
  const w = TANK.width - 0.002;
  const d = TANK.depth - 0.002;
  return (
    <group>
      <mesh ref={body} renderOrder={1}>
        <boxGeometry args={[w, 1, d]} />
        <meshStandardMaterial color="#38a3e0" transparent opacity={0.28} roughness={0.05} depthWrite={false} />
      </mesh>
      <mesh ref={surface} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#7cc8f0" transparent opacity={0.4} roughness={0.02} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** ฟองอากาศจาก Air stone เมื่อ Air Pump (M105) ON */
function Bubbles() {
  const low = useSceneStore((s) => s.lowGraphics);
  const count = low ? 16 : 48;
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({ phase: (i * 0.618) % 1, stone: i % AIR_STONES.length, a: i * 2.4 })), [count]);
  const intensity = useRef(0);
  const time = useRef(0);

  useFrame((_, dt) => {
    const snap = useLabStore.getState().snapshot;
    const m = mesh.current;
    if (!snap || !m) return;
    const k = Math.min(dt, 0.1);
    intensity.current = MathUtils.damp(intensity.current, snap.commands.airPump ? 1 : 0, 3, k);
    time.current += k;
    const waterH = cm(snap.tank.waterHeightCm);
    m.visible = intensity.current > 0.02 && waterH > 0.01;
    seeds.forEach((s, i) => {
      const [sx, sz] = AIR_STONES[s.stone]!;
      const t = (time.current * 0.55 + s.phase) % 1;
      const y = 0.012 + t * (waterH - 0.015);
      dummy.position.set(sx + 0.01 * Math.sin(s.a + t * 9), y, sz + 0.01 * Math.cos(s.a + t * 7));
      dummy.scale.setScalar((0.002 + 0.002 * t) * intensity.current);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {AIR_STONES.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.006, z]}>
          <cylinderGeometry args={[0.012, 0.012, 0.012, 16]} />
          <meshStandardMaterial color="#94a3b8" roughness={1} />
        </mesh>
      ))}
      <instancedMesh ref={mesh} args={[undefined, undefined, count]} renderOrder={3}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#f0f9ff" transparent opacity={0.75} roughness={0.1} />
      </instancedMesh>
    </group>
  );
}

export function Tank({ plantCount }: { plantCount: number }) {
  return (
    <group>
      <Walls />
      <Lid count={plantCount} />
      <Water />
      <Bubbles />
    </group>
  );
}

