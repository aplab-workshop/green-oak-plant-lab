import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CatmullRomCurve3, Color, InstancedMesh, MathUtils, Object3D, TubeGeometry, Vector3, type Group } from 'three';
import { useLabStore } from '../store/labStore';
import { plantVisuals } from './plantVisuals';
import { createLeafGeometry, createLeafMaterial } from './leafGeometry';
import { hash01, leafLayout } from './leafLayout';
import { POT, cm } from './layout';
import { useSceneStore } from './sceneStore';
import { CelebrationRing, badgeElements } from './PlantBadge';

const MAX_LEAVES = 32;
const LEAF_BASE_Y = POT.topY + 0.004;
/** ต้นที่ตายเอนล้ม (rad) */
const DEAD_TILT = 0.55;

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
  /** มุมเอนล้มของต้นที่ตาย (rad) */
  tilt: number;
  color: Color;
}

function NetPot({ selected }: { selected: boolean }) {
  const h = POT.topY - POT.bottomY;
  return (
    <group>
      {[0, 0.35, 0.7, 1].map((f) => <mesh key={f} position={[0, POT.bottomY + h * f, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[POT.bottomRadius + (POT.topRadius - POT.bottomRadius) * f, 0.0018, 5, 20]} />
        <meshStandardMaterial color="#283d36" roughness={0.65} />
      </mesh>)}
      {Array.from({ length: 14 }, (_, i) => {
        const a = i * Math.PI * 2 / 14;
        return <mesh key={i} position={[Math.sin(a) * 0.026, POT.bottomY + h / 2, Math.cos(a) * 0.026]} rotation={[0.13 * Math.cos(a), 0, -0.13 * Math.sin(a)]}>
          <boxGeometry args={[0.0023, h, 0.0023]} /><meshStandardMaterial color="#283d36" roughness={0.65} />
        </mesh>;
      })}
      {/* Clay pebbles */}
      <mesh position={[0, POT.topY - 0.004, 0]}>
        <cylinderGeometry args={[POT.topRadius * 0.95, POT.topRadius * 0.9, 0.008, 20]} />
        <meshStandardMaterial color="#635344" roughness={1} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => <mesh key={i}
        position={[Math.sin(i * 2.4) * 0.021, POT.topY, Math.cos(i * 2.4) * 0.021]}>
        <icosahedronGeometry args={[0.004 + (i % 2) * 0.001, 1]} /><meshStandardMaterial color={i % 2 ? '#93806a' : '#7b6955'} roughness={1} />
      </mesh>)}
      <mesh position={[0, POT.topY + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[POT.topRadius * 1.05, POT.topRadius * (selected ? 1.45 : 1.15), 32]} />
        <meshBasicMaterial color={selected ? '#10b981' : '#111827'} transparent opacity={selected ? 0.95 : 0.7} />
      </mesh>
    </group>
  );
}

function Roots({ plantId, smoothed, low }: { plantId: number; smoothed: React.RefObject<Smoothed>; low: boolean }) {
  const group = useRef<Group>(null);
  const geometry = useMemo(() => {
    const strands = low ? 8 : 18;
    const parts = Array.from({ length: strands }, (_, i) => {
      const a = (i / strands) * Math.PI * 2 + hash01(plantId, 50 + i);
      const spread = 0.25 + 0.35 * hash01(plantId, 80 + i);
      const pts = Array.from({ length: 6 }, (_, k) => {
        const t = k / 5;
        const wob = 0.06 * Math.sin(t * 9 + i) * t;
        return new Vector3(Math.cos(a) * (spread * t + wob), -t * (0.85 + 0.15 * hash01(plantId, i)), Math.sin(a) * (spread * t - wob));
      });
      const main = new TubeGeometry(new CatmullRomCurve3(pts), low ? 8 : 18, 0.012, 3, false);
      const branches = Array.from({ length: low ? 1 : 4 }, (_, j) => {
        const t = 0.24 + j * 0.16;
        const base = new CatmullRomCurve3(pts).getPoint(t);
        const end = base.clone().add(new Vector3(Math.cos(a + j) * 0.2, -0.17, Math.sin(a + j) * 0.2));
        return new TubeGeometry(new CatmullRomCurve3([base, base.clone().lerp(end, 0.5).add(new Vector3(0.04, 0, 0)), end]), 5, 0.005, 3, false);
      });
      return [main, ...branches];
    }).flat();
    const merged = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    return merged;
  }, [plantId, low]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    const g = group.current;
    if (!g || !smoothed.current) return;
    const len = Math.min(POT.bottomY - 0.006, Math.max(0.005, smoothed.current.rootM));
    // รากแผ่กว้างตาม Root length; จำกัดแนวดิ่งไม่ให้ทะลุก้นถัง (เฉพาะภาพ)
    const spread = 0.025 + 0.45 * smoothed.current.rootM;
    g.scale.set(spread, len, spread);
  });

  return (
    <group ref={group} position={[0, POT.bottomY + 0.004, 0]}>
        <mesh geometry={geometry}>
          <meshStandardMaterial color="#fff1cf" roughness={0.9} />
        </mesh>
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

  const geometry = useMemo(() => createLeafGeometry(low ? 40 : 96, low ? 5 : 12), [low]);
  const { material, uniforms } = useMemo(() => createLeafMaterial(POT.topY + 0.0015), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const mesh = useRef<InstancedMesh>(null);
  const leaves = useRef<Group>(null);
  const badge = useRef<Group>(null);
  const badgePos = useMemo(() => new Vector3(), []);
  const dummy = useMemo(() => new Object3D(), []);
  const target = useMemo(() => new Color(), []);
  const smoothed = useRef<Smoothed>({ droop: 0, wilt: 0, scale: 1, curl: 0, rootM: 0.05, tilt: 0, color: new Color('#2e9e52') });
  const initialised = useRef(false);

  useFrame(({ camera, size }, dt) => {
    const plant = useLabStore.getState().snapshot?.plants.find((p) => p.id === plantId);
    const m = mesh.current;
    if (!plant || !m) return;
    const v = plantVisuals(plant);
    const s = smoothed.current;
    target.set(v.leafColor);
    if (!initialised.current) {
      Object.assign(s, { droop: v.droop, wilt: v.wilted ? 1 : 0, scale: v.scale, curl: v.curl, rootM: cm(v.rootLengthCm), tilt: v.dead ? DEAD_TILT : 0 });
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
    s.tilt = MathUtils.damp(s.tilt, v.dead ? DEAD_TILT : 0, 1.5, k);
    if (leaves.current) leaves.current.rotation.z = s.tilt;
    // ป้ายลอยเหนือทรงพุ่ม สูงตามขนาดต้น
    if (badge.current) {
      badge.current.position.y = POT.topY + 0.03 + 0.03 * s.scale * (1 - 0.5 * s.droop);
      const el = badgeElements.get(plantId);
      if (el) {
        badge.current.getWorldPosition(badgePos).project(camera);
        const visible = badgePos.z < 1 && Math.abs(badgePos.x) < 1.1 && Math.abs(badgePos.y) < 1.1;
        el.style.display = visible ? '' : 'none';
        if (visible) el.style.transform = `translate(${((badgePos.x + 1) / 2) * size.width}px, ${((1 - badgePos.y) / 2) * size.height}px)`;
      }
    }

    uniforms.uBend.value = 0.25 + 1.3 * s.droop;
    uniforms.uWilt.value = s.wilt;
    uniforms.uCurl.value = s.curl;
    material.color.copy(s.color);

    const poses = leafLayout(plantId, Math.min(v.leafCount, low ? 16 : MAX_LEAVES), s.scale, s.droop);
    poses.forEach((p, i) => {
      dummy.position.set(Math.sin(p.yaw) * p.radialOffset, LEAF_BASE_Y + p.lift, Math.cos(p.yaw) * p.radialOffset);
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
      <CelebrationRing plantId={plantId} />
      <group ref={badge} />
      <group ref={leaves} position={[0, LEAF_BASE_Y, 0]}><group position={[0, -LEAF_BASE_Y, 0]}>
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
      </group></group>
      {showRoots && <Roots plantId={plantId} smoothed={smoothed} low={low} />}
    </group>
  );
}
