import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Color, MathUtils, type DirectionalLight, type HemisphereLight } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useLabStore } from '../store/labStore';
import { Actuators } from './Actuators';
import { Lettuce } from './Lettuce';
import { Sensors } from './Sensors';
import { Tank } from './Tank';
import { Greenhouse } from './Greenhouse';
import { Mascot } from './Mascot';
import { potPosition } from './layout';
import { useSceneStore } from './sceneStore';

const CAMERA_POS: [number, number, number] = [1.06, 0.77, 1.62];
const TARGET: [number, number, number] = [0.04, 0.16, 0];

const DAY_BG = new Color('#e5eee5');
const NIGHT_BG = new Color('#27394b');

/** 0 = กลางคืน, 1 = กลางวัน ตามชั่วโมงจำลอง (06–18 สว่าง เปลี่ยนแบบนุ่มนวล) */
export function daylight(minuteOfDay: number): number {
  const h = minuteOfDay / 60;
  return MathUtils.smoothstep(h, 5, 7) * (1 - MathUtils.smoothstep(h, 18, 20));
}

/** แสงห้องและสีพื้นหลังตามเวลาจำลอง (Day/Night visualization) */
function Ambience() {
  const scene = useThree((s) => s.scene);
  const hemi = useRef<HemisphereLight>(null);
  const sun = useRef<DirectionalLight>(null);
  const low = useSceneStore((s) => s.lowGraphics);
  const bg = useRef(new Color(DAY_BG));
  const level = useRef<number | null>(null);

  useFrame((_, dt) => {
    const minute = useLabStore.getState().snapshot?.sim.minuteOfDay ?? 720;
    const target = useSceneStore.getState().dayNight ? daylight(minute) : 1;
    level.current = level.current === null ? target : MathUtils.damp(level.current, target, 2, Math.min(dt, 0.1));
    const d = level.current;
    bg.current.copy(NIGHT_BG).lerp(DAY_BG, d);
    scene.background = bg.current;
    if (hemi.current) hemi.current.intensity = 0.8 + 1.4 * d;
    if (sun.current) sun.current.intensity = 0.25 + 1.8 * d;
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={['#fff8df', '#91aaa2', 1]} />
      <directionalLight position={[-1, 0.8, -0.5]} intensity={0.8} color="#dcefff" />
      <directionalLight
        ref={sun}
        position={[0.8, 1.4, 0.6]}
        castShadow={!low}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-1}
        shadow-camera-right={1}
        shadow-camera-top={1}
        shadow-camera-bottom={-1}
        shadow-normalBias={0.003}
      />
    </>
  );
}

function Controls() {
  const ref = useRef<OrbitControlsImpl>(null);
  const seq = useSceneStore((s) => s.cameraResetSeq);
  const focus = useSceneStore((s) => s.focus);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const fit = Math.max(1, Math.min(2.1, 1.1 / (size.width / size.height)));
  useEffect(() => {
    if (!ref.current) return;
    camera.position.set(...CAMERA_POS.map((v, i) => TARGET[i]! + (v - TARGET[i]!) * fit) as [number, number, number]);
    ref.current.target.set(...TARGET);
    ref.current.update();
  }, [seq, camera, fit]);
  useEffect(() => {
    if (!focus || !ref.current) return;
    const [x, y, z] = focus.point;
    const state = useLabStore.getState();
    const plant = state.snapshot?.plants.find((p) => p.id === state.selectedPlantId);
    const size = Math.max(1, Math.cbrt((plant?.biomassG ?? 5) / 5));
    ref.current.target.set(x, y + 0.04 * size, z);
    camera.position.set(x + 0.18 * size, y + 0.14 * size, z + 0.22 * size);
    ref.current.update();
  }, [focus, camera]);
  return (
    <OrbitControls
      ref={ref}
      makeDefault
      target={TARGET}
      enablePan
      enableDamping
      minDistance={0.25}
      maxDistance={5}
      maxPolarAngle={Math.PI * 0.49}
    />
  );
}

function Plants() {
  const ids = useLabStore((s) => s.snapshot?.plants.map((p) => p.id).join(',') ?? '');
  const list = ids ? ids.split(',').map(Number) : [];
  return (
    <>
      {list.map((id, i) => {
        const [x, z] = potPosition(i, list.length);
        return <Lettuce key={id} plantId={id} x={x} z={z} />;
      })}
    </>
  );
}

/**
 * 3D DWC Scene — ภาพทั้งหมดอ่านค่าจาก Snapshot ของ Server
 * (ไม่มี Animation ที่เล่นเองโดยไม่ขึ้นกับ Simulation)
 */
export default function Scene3D() {
  const low = useSceneStore((s) => s.lowGraphics);
  const plantCount = useLabStore((s) => s.snapshot?.plants.length ?? 6);
  return (
    <Canvas
      // คง Canvas และ Html labels ไว้เมื่อสลับ Low; ลด DPR/เงา/Geometry แทน
      shadows={!low}
      dpr={low ? 1 : [1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: CAMERA_POS, fov: 40, near: 0.01, far: 10 }}
      onPointerMissed={() => useSceneStore.getState().selectDevice(null)}
    >
      <Ambience />
      <Controls />
      <Greenhouse />
      <Tank plantCount={plantCount} />
      <Plants />
      <Actuators />
      <Sensors />
      <Mascot />
    </Canvas>
  );
}
