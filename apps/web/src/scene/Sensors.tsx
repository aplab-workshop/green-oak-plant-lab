import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils, type Group } from 'three';
import { useLabStore } from '../store/labStore';
import { Clickable } from './Clickable';
import { POT, TANK, cm } from './layout';

const LID_TOP = POT.topY;
const PROBE_Z = -TANK.depth / 2 + 0.025;

/** หัววัดจุ่มจากฝาลงในน้ำ */
function Probe({ x, color, length = 0.17 }: { x: number; color: string; length?: number }) {
  return (
    <group position={[x, LID_TOP, PROBE_Z]}>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.04, 12]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[0, -length / 2, 0]}>
        <cylinderGeometry args={[0.0045, 0.0045, length, 10]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.0015, 0.0015, 0.04, 6]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
    </group>
  );
}

/** ทุ่นวัดระดับน้ำ — ขึ้นลงตามผิวน้ำจริง */
function LevelFloat() {
  const float = useRef<Group>(null);
  const y = useRef<number | null>(null);
  useFrame((_, dt) => {
    const tank = useLabStore.getState().snapshot?.tank;
    if (!tank || !float.current) return;
    const target = Math.max(0.01, cm(tank.waterHeightCm));
    y.current = y.current === null ? target : MathUtils.damp(y.current, target, 4, Math.min(dt, 0.1));
    float.current.position.y = y.current;
  });
  return (
    <group position={[0.21, 0, 0.16]}>
      <mesh position={[0, TANK.height / 2 + 0.006, 0]}>
        <cylinderGeometry args={[0.002, 0.002, TANK.height + 0.012, 6]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <group ref={float}>
        <mesh>
          <cylinderGeometry args={[0.012, 0.012, 0.012, 16]} />
          <meshStandardMaterial color="#facc15" roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

export function Sensors() {
  return (
    <group>
      <Clickable device={{ kind: 'sensor', key: 'ph' }} labelOffset={[-0.08, 0.3, PROBE_Z]}>
        <Probe x={-0.08} color="#2563eb" />
      </Clickable>
      <Clickable device={{ kind: 'sensor', key: 'ecMsCm' }} labelOffset={[-0.04, 0.3, PROBE_Z]}>
        <Probe x={-0.04} color="#7c3aed" />
      </Clickable>
      <Clickable device={{ kind: 'sensor', key: 'waterTempC' }} labelOffset={[0.06, 0.3, PROBE_Z]}>
        <Probe x={0.06} color="#dc2626" length={0.16} />
      </Clickable>
      <Clickable device={{ kind: 'sensor', key: 'waterLevelPct' }} labelOffset={[0.21, 0.26, 0.16]}>
        <LevelFloat />
      </Clickable>

      {/* Air temperature / humidity sensor บนเสา */}
      <group position={[-0.3, 0, -0.3]}>
        <mesh position={[0, 0.11, 0]}>
          <cylinderGeometry args={[0.004, 0.004, 0.62, 8]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
        <Clickable device={{ kind: 'sensor', key: 'airTempC' }} position={[0, 0.43, 0]} labelOffset={[0, 0.05, 0]}>
          {[-0.024, -0.012, 0, 0.012, 0.024].map((y) => (
            <mesh key={y} position={[0, y, 0]} castShadow>
              <cylinderGeometry args={[0.019, 0.024, 0.008, 16]} />
              <meshStandardMaterial color="#fffdf4" roughness={0.4} />
            </mesh>
          ))}
        </Clickable>
      </group>

      {/* PAR quantum sensor ที่ระดับยอดพืช */}
      <group position={[0, LID_TOP, -0.17]}>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.002, 0.002, 0.06, 6]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
        <Clickable device={{ kind: 'sensor', key: 'ppfd' }} position={[0, 0.062, 0]} labelOffset={[0, 0.04, 0]}>
          <mesh>
            <cylinderGeometry args={[0.012, 0.012, 0.008, 20]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0, 0.0045, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.002, 20]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
        </Clickable>
      </group>

      {/* Flow sensor บนท่อ Refill */}
      <Clickable device={{ kind: 'sensor', key: 'flowLpm' }} position={[-0.03, 0.15, -0.345]} labelOffset={[0, 0.04, 0]}>
        <mesh rotation={[0.1, 0, 0]}>
          <cylinderGeometry args={[0.011, 0.011, 0.03, 12]} />
          <meshStandardMaterial color="#1d4ed8" />
        </mesh>
      </Clickable>

      {/* Power meter ปลั๊กพ่วง */}
      <Clickable device={{ kind: 'sensor', key: 'powerW' }} position={[-0.25, -0.187, 0.36]} labelOffset={[0, 0.05, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.16, 0.024, 0.05]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
        <mesh position={[-0.055, 0.0125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.035, 0.02]} />
          <meshStandardMaterial color="#064e3b" emissive="#10b981" emissiveIntensity={0.6} />
        </mesh>
      </Clickable>
    </group>
  );
}
