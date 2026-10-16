import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import { CatmullRomCurve3, Color, DoubleSide, InstancedMesh, MathUtils, Object3D, TubeGeometry, Vector3, type Group } from 'three';
import { useLabStore } from '../store/labStore';
import { plantVisuals } from './plantVisuals';
import { createLeafGeometry, createLeafMaterial } from './leafGeometry';
import { hash01, leafLayout } from './leafLayout';
import { POT, cm } from './layout';
import { useSceneStore } from './sceneStore';

const MAX_LEAVES = 32;
const LEAF_BASE_Y = POT.topY + 0.004;

interface Props {
  plantId: number;
  x: number;
  z: number;
}

/** ค่าภาพปัจจุบันที่ค่อย ๆ เคลื่อนเข้าหาค่าจาก Server (ลื่นไหล แต่เป้าหมายมาจาก Simulation เสมอ) */
interface Smoothed {
  droop: number;
  wilt: number;
  scale: number;
  curl: number;
  rootM: number;
  color: Color;
}

function NetPot({ selected }: { selected: boolean }) {
  const h = POT.topY - POT.bottomY;
  return (
    <group>
      <mesh position={[0, POT.bottomY + h / 2, 0]} castShadow>
        <cylinderGeometry args={[POT.topRadius, POT.bottomRadius, h, 20, 1, true]} />
        <meshStandardMaterial color="#1f2937" roughness={0.8} side={DoubleSide} />
      </mesh>
      {/* Clay pebbles */}
      <mesh position={[0, POT.topY - 0.004, 0]}>
        <cylinderGeometry args={[POT.topRadius * 0.95, POT.topRadius * 0.9, 0.008, 20]} />
        <meshStandardMaterial color="#9a5b3b" roughness={1} />
      </mesh>
      <mesh position={[0, POT.topY + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[POT.topRadius * 1.05, POT.topRadius * (selected ? 1.45 : 1.15), 32]} />
        <meshBasicMaterial color={selected ? '#10b981' : '#111827'} transparent opacity={selected ? 0.95 : 0.7} />
      </mesh>
    </group>
  );
}

function Roots({ plantId, smoothed, low }: { plantId: number; smoothed: React.RefObject<Smoothed>; low: boolean }) {
  const group = useRef<Group>(null);
  const geometries = useMemo(() => {
    const strands = low ? 6 : 12;
    return Array.from({ length: strands }, (_, i) => {
      const a = (i / strands) * Math.PI * 2 + hash01(plantId, 50 + i);
      const spread = 0.25 + 0.35 * hash01(plantId, 80 + i);
      const pts = Array.from({ length: 6 }, (_, k) => {
        const t = k / 5;
        const wob = 0.06 * Math.sin(t * 9 + i) * t;
        return new Vector3(Math.cos(a) * (spread * t + wob), -t * (0.85 + 0.15 * hash01(plantId, i)), Math.sin(a) * (spread * t - wob));
      });
      return new TubeGeometry(new CatmullRomCurve3(pts), low ? 8 : 16, 0.035, low ? 3 : 4, false);
    });
  }, [plantId, low]);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);

  useFrame(() => {
    const g = group.current;
    if (!g || !smoothed.current) return;
    const len = Math.max(0.005, smoothed.current.rootM);
    // รากยาวขึ้นตาม Root length และแผ่กว้างขึ้นเมื่อโต (Tube radius 0.035 × scale ≈ 1.5–3 mm)
    const spread = 0.02 + 0.4 * len;
    g.scale.set(spread, len, spread);
  });

  return (
    <group ref={group} position={[0, POT.bottomY + 0.004, 0]}>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color="#efe3c2" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * ผักสลัด Green Oak 1 ต้น — ใบเป็น InstancedMesh (1 draw call ต่อต้น)
 * ค่าทั้งหมดมาจาก PlantState ผ่าน plantVisuals() และค่อย ๆ damp ให้ Animation ลื่น
 */
export function Lettuce({ plantId, x, z }: Props) {
  const low = useSceneStore((s) => s.lowGraphics);
  const showRoots = useSceneStore((s) => s.showRoots);
  const selected = useLabStore((s) => s.selectedPlantId === plantId);
  const select = useLabStore((s) => s.setSelectedPlant);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const geometry = useMemo(() => createLeafGeometry(low ? 14 : 28, low ? 2 : 4), [low]);
  const { material, uniforms } = useMemo(() => createLeafMaterial(POT.topY + 0.0015), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const target = useMemo(() => new Color(), []);
  const smoothed = useRef<Smoothed>({ droop: 0, wilt: 0, scale: 1, curl: 0, rootM: 0.05, color: new Color('#2e9e52') });
  const initialised = useRef(false);

  useFrame((_, dt) => {
    const plant = useLabStore.getState().snapshot?.plants.find((p) => p.id === plantId);
    const m = mesh.current;
    if (!plant || !m) return;
    const v = plantVisuals(plant);
    const s = smoothed.current;
    target.set(v.leafColor);
    if (!initialised.current) {
      Object.assign(s, { droop: v.droop, wilt: v.wilted ? 1 : 0, scale: v.scale, curl: v.curl, rootM: cm(v.rootLengthCm) });
      s.color.copy(target);
      initialised.current = true;
    }
    const k = Math.min(dt, 0.1);
    s.droop = MathUtils.damp(s.droop, v.droop, 2.5, k);
    s.wilt = MathUtils.damp(s.wilt, MathUtils.smoothstep(v.droop, 0.45, 0.95), 2.5, k);
    s.scale = MathUtils.damp(s.scale, v.scale, 2, k);
    s.curl = MathUtils.damp(s.curl, v.curl, 2, k);
    s.rootM = MathUtils.damp(s.rootM, cm(v.rootLengthCm), 2, k);
    s.color.lerp(target, 1 - Math.exp(-2.5 * k));

    uniforms.uBend.value = 0.25 + 1.3 * s.droop;
    uniforms.uWilt.value = s.wilt;
    uniforms.uCurl.value = s.curl;
    material.color.copy(s.color);

    const poses = leafLayout(plantId, Math.min(v.leafCount, low ? 16 : MAX_LEAVES), s.scale, s.droop);
    poses.forEach((p, i) => {
      dummy.position.set(Math.sin(p.yaw) * p.radialOffset, LEAF_BASE_Y, Math.cos(p.yaw) * p.radialOffset);
      dummy.rotation.set(-p.elevation, p.yaw, 0, 'YXZ');
      dummy.scale.set(p.width, p.length, p.length);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.count = poses.length;
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    select(plantId);
    useSceneStore.getState().selectDevice(null);
  };

  return (
    <group position={[x, 0, z]}>
      <NetPot selected={selected} />
      <instancedMesh
        ref={mesh}
        args={[geometry, material, MAX_LEAVES]}
        castShadow={!low}
        onClick={onClick}
        onDoubleClick={(e) => {
          e.stopPropagation();
          useSceneStore.getState().focusOn([x, POT.topY, z]);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      />
      {showRoots && <Roots plantId={plantId} smoothed={smoothed} low={low} />}
    </group>
  );
}
