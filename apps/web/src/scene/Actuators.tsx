import { useEffect, useMemo, useRef } from 'react';
import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  MathUtils,
  TubeGeometry,
  Vector3,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
  type Points,
  type SpotLight,
} from 'three';
import type { ActuatorCommands } from '@gol/shared';
import { useLabStore } from '../store/labStore';
import { Clickable } from './Clickable';
import { LED_Y, cm } from './layout';
import { useSceneStore } from './sceneStore';

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

function Pipe({ points, radius = 0.004, color = '#cbd5e1' }: { points: [number, number, number][]; radius?: number; color?: string }) {
  const geometry = useMemo(() => new TubeGeometry(new CatmullRomCurve3(points.map((p) => new Vector3(...p))), 48, radius, 8, false), [points, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} roughness={0.5} />
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

/** Ventilation Fan (M100) */
function VentFan({ x }: { x: number }) {
  const blades = useRef<Group>(null);
  const speed = useRef(0);
  useFrame((_, dt) => {
    const k = Math.min(dt, 0.1);
    speed.current = MathUtils.damp(speed.current, commands()?.fan ? 22 : 0, 1.5, k);
    if (blades.current) blades.current.rotation.x += speed.current * k;
  });
  return (
    <group position={[x, 0.1, -0.21]}>
      <Clickable device={{ kind: 'actuator', key: 'fan' }} position={[0, 0.34, 0]} labelOffset={[0, 0.09, 0]}>
        {[-1, 1].map((s) => <group key={s}>
          <mesh position={[0, s * 0.073, 0]}><boxGeometry args={[0.025, 0.014, 0.16]} /><meshStandardMaterial color="#354a46" metalness={0.4} /></mesh>
          <mesh position={[0, 0, s * 0.073]}><boxGeometry args={[0.025, 0.16, 0.014]} /><meshStandardMaterial color="#354a46" metalness={0.4} /></mesh>
        </group>)}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.065, 0.006, 8, 32]} />
          <meshStandardMaterial color="#e2e8f0" />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.02, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.03, 16]} />
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>
        <group ref={blades}>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} rotation={[(i * Math.PI * 2) / 5, 0, 0]} position={[0.004, 0, 0]}>
              <boxGeometry args={[0.003, 0.055, 0.022]} />
              <meshStandardMaterial color="#425c54" metalness={0.25} />
            </mesh>
          ))}
        </group>
        <StatusLed bit="fan" position={[-0.03, -0.03, 0.02]} />
      </Clickable>
    </group>
  );
}

/** Humidifier (M101) พร้อมละอองหมอก */
function Humidifier() {
  const low = useSceneStore((s) => s.lowGraphics);
  const points = useRef<Points>(null);
  const intensity = useRef(0);
  const N = 70;
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(N * 3), 3));
    return g;
  }, []);
  const seeds = useMemo(() => Array.from({ length: N }, (_, i) => ({ p: (i * 0.618) % 1, a: i * 2.39 })), []);
  const t = useRef(0);
  useFrame((_, dt) => {
    const k = Math.min(dt, 0.1);
    intensity.current = MathUtils.damp(intensity.current, commands()?.humidifier ? 1 : 0, 2, k);
    t.current += k;
    const pts = points.current;
    if (!pts) return;
    pts.visible = intensity.current > 0.02;
    const pos = geometry.getAttribute('position') as BufferAttribute;
    seeds.forEach((s, i) => {
      const u = (t.current * 0.25 + s.p) % 1;
      pos.setXYZ(i, Math.cos(s.a) * 0.03 * u - 0.03 * u, 0.12 + u * 0.18, Math.sin(s.a) * 0.03 * u);
    });
    pos.needsUpdate = true;
    (pts.material as { opacity: number }).opacity = 0.5 * intensity.current;
  });
  return (
    <group position={[0.39, 0.38, -0.4]}>
      <Clickable device={{ kind: 'actuator', key: 'humidifier' }} labelOffset={[0, 0.17, 0]}>
        <RoundedBox args={[0.075, 0.1, 0.055]} radius={0.012} position={[0, 0.05, 0]} castShadow>
          <meshStandardMaterial color="#fffdf2" roughness={0.4} />
        </RoundedBox>
        <mesh position={[0, 0.11, 0]}>
          <cylinderGeometry args={[0.012, 0.018, 0.02, 16]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
        <StatusLed bit="humidifier" position={[0, 0.06, 0.05]} />
      </Clickable>
      {!low && (
        <points ref={points} geometry={geometry}>
          <pointsMaterial color="#e0f2fe" size={0.012} transparent opacity={0} depthWrite={false} sizeAttenuation />
        </points>
      )}
    </group>
  );
}

const REFILL_OUTLET: [number, number, number] = [-0.2, 0.19, -0.17];

/** Water Refill Pump (M102) + ถังสำรอง + สายน้ำที่ไหลลงถังจริง */
function RefillSystem() {
  const stream = useRef<Mesh>(null);
  const flow = useRef(0);
  useFrame((state, dt) => {
    const snap = useLabStore.getState().snapshot;
    const s = stream.current;
    if (!snap || !s) return;
    flow.current = MathUtils.damp(flow.current, snap.commands.refillPump ? 1 : 0, 6, Math.min(dt, 0.1));
    const waterY = cm(snap.tank.waterHeightCm);
    const len = Math.max(0.001, REFILL_OUTLET[1] - waterY);
    s.visible = flow.current > 0.05;
    s.scale.set(flow.current, len, flow.current);
    s.position.y = REFILL_OUTLET[1] - len / 2;
    (s.material as MeshStandardMaterial).opacity = 0.45 + 0.1 * Math.sin(state.clock.elapsedTime * 30);
  });
  const pipe: [number, number, number][] = [
    [-0.03, -0.16, -0.36],
    [-0.03, 0.27, -0.33],
    [-0.2, 0.27, -0.24],
    [-0.2, 0.25, -0.17],
    REFILL_OUTLET,
  ];
  return (
    <group>
      {/* ถังน้ำสำรอง */}
      <mesh position={[-0.17, -0.11, -0.36]}>
        <boxGeometry args={[0.18, 0.18, 0.1]} />
        <meshStandardMaterial color="#bfdbfe" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <mesh position={[-0.17, -0.135, -0.36]}>
        <boxGeometry args={[0.17, 0.13, 0.09]} />
        <meshStandardMaterial color="#38a3e0" transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <Clickable device={{ kind: 'actuator', key: 'refillPump' }} position={[-0.03, -0.175, -0.36]} labelOffset={[0, 0.07, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.06, 0.05, 0.05]} />
          <meshStandardMaterial color="#0f766e" roughness={0.5} />
        </mesh>
        <StatusLed bit="refillPump" position={[0.031, 0.012, 0]} />
      </Clickable>
      <Pipe points={pipe} radius={0.006} color="#278aaa" />
      <mesh ref={stream} position={[REFILL_OUTLET[0], 0.1, REFILL_OUTLET[2]]} renderOrder={4}>
        <cylinderGeometry args={[0.004, 0.006, 1, 10, 1, true]} />
        <meshStandardMaterial color="#7dd3fc" transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Nutrient Pump A (M103) / B (M104) */
function NutrientPumps() {
  const bottles: { key: 'nutrientA' | 'nutrientB'; x: number; color: string }[] = [
    { key: 'nutrientA', x: 0.35, color: '#278cda' },
    { key: 'nutrientB', x: 0.45, color: '#e76554' },
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
          <Pipe
            points={[
              [b.x, 0.04, -0.26],
              [b.x, 0.25, -0.24],
              [0.22 - i * 0.03, 0.25, -0.2],
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

/** Air Pump (M105) — สั่นเล็กน้อยเมื่อทำงาน */
function AirPump() {
  const body = useRef<Group>(null);
  useFrame((state) => {
    if (body.current) body.current.position.x = commands()?.airPump ? Math.sin(state.clock.elapsedTime * 90) * 0.0008 : 0;
  });
  return (
    <group>
      <Clickable device={{ kind: 'actuator', key: 'airPump' }} position={[-0.38, -0.175, -0.25]} labelOffset={[0, 0.07, 0]}>
        <group ref={body}>
          <mesh castShadow>
            <boxGeometry args={[0.09, 0.05, 0.06]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
          </mesh>
          <StatusLed bit="airPump" position={[0.046, 0.012, 0]} />
        </group>
      </Clickable>
      <Pipe
        points={[
          [-0.34, -0.17, -0.25],
          [-0.3, 0.25, -0.24],
          [-0.15, 0.25, -0.12],
          [-0.12, 0.1, -0.02],
          [-0.12, 0.012, 0],
        ]}
        radius={0.0025}
        color="#f8fafc"
      />
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
      <RefillSystem />
      <NutrientPumps />
      <AirPump />
    </group>
  );
}

