import { useRef } from 'react';
import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,


  Color,
  MathUtils,


  type MeshBasicMaterial,
  type MeshStandardMaterial,

  type SpotLight,
} from 'three';
import type { ActuatorCommands } from '@gol/shared';
import { useLabStore } from '../store/labStore';
import { Clickable } from './Clickable';
import { VentFan } from './VentFan';
import { Humidifier, UtilityEquipment } from './UtilityEquipment';
import { LED_Y } from './layout';
import { useSceneStore } from './sceneStore';
import { RoutedPipe } from './Plumbing';

type BitKey = Exclude<keyof ActuatorCommands, 'ledPct'>;

const commands = () => useLabStore.getState().snapshot?.commands;

const ON = new Color('#22c55e');
const OFF = new Color('#475569');

/** ไฟสถานะบนอุปกรณ์ (เขียว = ON) */
function StatusLed({ bit, position }: { bit: BitKey; position: [number, number, number] }) {
  const mat = useRef<MeshStandardMaterial>(null);
  useFrame(() => {
    const on = commands()?.[bit] ?? false;
    if (!mat.current) return;
    mat.current.color.copy(on ? ON : OFF);
    mat.current.emissive.copy(on ? ON : OFF);
    mat.current.emissiveIntensity = on ? 1.5 : 0;
  });
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.005, 10, 8]} />
      <meshStandardMaterial ref={mat} />
    </mesh>
  );
}

/** Dimmable LED Grow Light (D200) */
function LedFixture({ x }: { x: number }) {
  const panel = useRef<MeshStandardMaterial>(null);
  const cone = useRef<MeshBasicMaterial>(null);
  const light = useRef<SpotLight>(null);
  const level = useRef(0);
  const low = useSceneStore((s) => s.lowGraphics);
  useFrame((_, dt) => {
    level.current = MathUtils.damp(level.current, (commands()?.ledPct ?? 0) / 100, 6, Math.min(dt, 0.1));
    const l = level.current;
    if (panel.current) panel.current.emissiveIntensity = 0.05 + 2.2 * l;
    if (cone.current) cone.current.opacity = 0.025 * l;
    if (light.current) light.current.intensity = 0.22 * l;
  });
  return (
    <Clickable device={{ kind: 'actuator', key: 'ledPct' }} position={[x, LED_Y, -0.08]} labelOffset={[0, 0.05, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.21, 0.018, 0.065]} />
        <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, -0.0095, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.19, 0.052]} />
        <meshStandardMaterial ref={panel} color="#fce7f3" emissive="#f5a5d8" emissiveIntensity={0} />
      </mesh>
      {[-0.08, 0.08].map((x) => (
        <mesh key={x} position={[x, 0.045, 0]}>
          <cylinderGeometry args={[0.0012, 0.0012, 0.09, 4]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
      ))}
      {/* กรวยแสงเป็นแค่ภาพ ไม่รับการคลิก (ไม่งั้นบังต้นผักข้างใต้) */}
      <mesh position={[0, -0.19, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.07, 0.14, 0.36, 4, 1, true]} />
        <meshBasicMaterial ref={cone} color="#fbd3ec" transparent opacity={0} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      <spotLight
        ref={light}
        position={[0, -0.02, 0]}
        angle={0.9}
        penumbra={0.6}
        distance={1.2}
        intensity={0}
        color="#fff1f2"
        castShadow={!low}
        shadow-mapSize={[512, 512]}
        target-position={[0, -1, 0]}
      />
    </Clickable>
  );
}

/** Nutrient Pump A (M103) / B (M104) และ pH Down Pump (M106, P22) */
function NutrientPumps() {
  const bottles: { key: 'nutrientA' | 'nutrientB' | 'phDown'; x: number; color: string }[] = [
    { key: 'nutrientA', x: 0.35, color: '#278cda' },
    { key: 'nutrientB', x: 0.45, color: '#e76554' },
    { key: 'phDown', x: 0.55, color: '#8b5cf6' },
  ];
  return (
    <group>
      {bottles.map((b, i) => (
        <group key={b.key}>
          <RoundedBox args={[0.075, 0.12, 0.08]} radius={0.009} position={[b.x, 0.075, -0.3]} castShadow>
            <meshStandardMaterial color="#fffbed" roughness={0.4} />
          </RoundedBox>
          <mesh position={[b.x, 0.14, -0.3]}><cylinderGeometry args={[0.013, 0.013, 0.012, 16]} /><meshStandardMaterial color={b.color} /></mesh>
          <Clickable device={{ kind: 'actuator', key: b.key }} position={[b.x, 0.02, -0.26]} labelOffset={[0, 0.06, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.05, 0.04, 0.04]} />
              <meshStandardMaterial color={b.color} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0, 0.021]} rotation={[0, 0, 0]}>
              <circleGeometry args={[0.012, 16]} />
              <meshStandardMaterial color={b.color} />
            </mesh>
            <StatusLed bit={b.key} position={[0.018, 0.015, 0.021]} />
          </Clickable>
          <RoutedPipe
            points={[
              [b.x, 0.04, -0.26],
              [b.x, 0.23, -0.26],
              [b.x, 0.23, -0.22 - i * 0.008],
              [0.2 - i * 0.03, 0.23, -0.22 - i * 0.008],
              [0.2 - i * 0.03, 0.23, -0.17],
              [0.2 - i * 0.03, 0.21, -0.17],
            ]}
            radius={0.0022}
            color="#d9e7df"
          />
        </group>
      ))}
    </group>
  );
}

export function Actuators() {
  return (
    <group>
      <LedFixture x={-0.12} />
      <LedFixture x={0.12} />
      <VentFan x={-0.46} />
      <VentFan x={0.54} />
      <Humidifier />
      <UtilityEquipment />
      <NutrientPumps />

    </group>
  );
}

