import { Suspense, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, useTexture } from '@react-three/drei';
import { CanvasTexture, MathUtils, SRGBColorSpace, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import type { ChallengeKind } from '@gol/shared';
import { useLabStore } from '../store/labStore';
import { TANK } from './layout';

/** พื้นทางเดินในเรือนกระจก (m) */
const FLOOR_Y = -0.2;
/** ความสูง Mascot (m) — สูงเกือบเท่าถัง */
const HEIGHT = 0.22;
/** ทางวิ่ง: ขอบเกาะขวา → หน้าถังตามทางเดินหิน → มุมหน้าซ้ายของถัง (x, z) */
const PATH: [number, number][] = [[0.74, 0.5], [-0.02, 0.5], [-0.12, 0.3]];
/** ช่วง progress ที่ยืนอยู่หน้าถัง (เตะที่ 0.5) */
const ARRIVE = 0.42;
const LEAVE = 0.58;
/** รูรั่วที่มุมหน้าซ้ายล่างของถัง */
const HOLE: [number, number, number] = [-0.16, 0.02, TANK.depth / 2 + 0.012];

const SEG = PATH.slice(1).map((p, i) => Math.hypot(p[0] - PATH[i]![0], p[1] - PATH[i]![1]));
const PATH_LEN = SEG.reduce((a, b) => a + b, 0);

/** ตำแหน่งบนทางวิ่งตามระยะ d (0 = ขอบเกาะ, PATH_LEN = หน้าถัง) */
function pointAt(d: number): [number, number] {
  let rest = MathUtils.clamp(d, 0, PATH_LEN);
  for (let i = 0; i < SEG.length; i++) {
    const len = SEG[i]!;
    if (rest <= len || i === SEG.length - 1) {
      const t = len > 0 ? rest / len : 0;
      const a = PATH[i]!, b = PATH[i + 1]!;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    rest -= len;
  }
  return PATH[PATH.length - 1]!;
}

/** ของที่ Mascot ถือมา (P46 / SPEC § 4.29) — ถังรั่วไม่ถือ (เตะถัง) */
const PROP_EMOJI: Partial<Record<ChallengeKind, string>> = { heatWave: '🔥', dryAir: '🌵' };
const PROP_SIZE = 0.09;

/** Emoji → Texture (วาดครั้งเดียว) */
function emojiTexture(emoji: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.font = '104px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(emoji, 64, 70);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/**
 * Mascot AP LAB วิ่งมาเตะถังให้รั่ว / ถือคลื่นความร้อน 🔥 หรืออากาศแห้ง 🌵 มาปล่อย แล้ววิ่งออก (P41 § 4.24, P46 § 4.29)
 * ขับด้วย snapshot.mascot.progress จาก Server (เวลาจำลอง) — หยุดเมื่อ Pause; ฝั่ง Web แค่ทำให้ลื่นระหว่าง Snapshot
 */
function MascotSprite() {
  const run = useTexture('/mascot/run.png');
  const happy = useTexture('/mascot/happy.png');
  run.colorSpace = SRGBColorSpace;
  happy.colorSpace = SRGBColorSpace;
  const root = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const mat = useRef<MeshBasicMaterial>(null);
  const shown = useRef<number | null>(null);
  const prop = useRef<Mesh>(null);
  const propMat = useRef<MeshBasicMaterial>(null);
  const propTex = useMemo(() => Object.fromEntries(Object.entries(PROP_EMOJI).map(([k, e]) => [k, emojiTexture(e!)])) as Partial<Record<ChallengeKind, CanvasTexture>>, []);

  useFrame((_, dt) => {
    const mascot = useLabStore.getState().snapshot?.mascot ?? null;
    const target = mascot?.progress ?? null;
    if (!root.current || !body.current || !mat.current || !prop.current || !propMat.current) return;
    if (target === null) {
      shown.current = null;
      root.current.visible = false;
      return;
    }
    // ไล่ตามค่าจาก Server ให้ลื่น (Snapshot ทุก 200 ms) แต่ไม่วิ่งล้ำหน้า Server
    shown.current = shown.current === null || target < shown.current
      ? target
      : MathUtils.damp(shown.current, target, 10, Math.min(dt, 0.1));
    const p = shown.current;
    const entering = p < ARRIVE;
    const atTank = p >= ARRIVE && p < LEAVE;
    const d = entering ? (p / ARRIVE) * PATH_LEN : atTank ? PATH_LEN : (1 - (p - LEAVE) / (1 - LEAVE)) * PATH_LEN;
    const [x, z] = pointAt(d);
    // เด้งตามระยะที่วิ่ง (ไม่ใช่เวลาจริง) · หน้าถังกระโดดดีใจตอนเตะ
    const hop = atTank
      ? 0.035 * Math.max(0, Math.sin(((p - ARRIVE) / (LEAVE - ARRIVE)) * Math.PI * 2))
      : 0.022 * Math.abs(Math.sin(d * 38));
    root.current.visible = true;
    root.current.position.set(x, FLOOR_Y, z);
    body.current.position.y = HEIGHT / 2 + hop;
    // ท่าวิ่งหันขวาในภาพ: วิ่งเข้า (ไปทาง −x) พลิกภาพ, วิ่งออกใช้ภาพเดิม
    const tex = atTank ? happy : run;
    if (mat.current.map !== tex) {
      mat.current.map = tex;
      mat.current.needsUpdate = true;
    }
    const aspect = tex.image ? (tex.image as HTMLImageElement).width / (tex.image as HTMLImageElement).height : 0.6;
    // ปรากฏ/หายแบบเด้งที่ขอบเกาะ
    const pop = MathUtils.smoothstep(p, 0, 0.04) * (1 - MathUtils.smoothstep(p, 0.96, 1));
    body.current.scale.set((entering ? -1 : 1) * HEIGHT * aspect * pop, HEIGHT * pop, 1);
    // ของที่ถือ: ชูเหนือหัวตอนวิ่งเข้า, ตอนปล่อย (0.5) ขยายแล้วจางหาย — วิ่งออกมือเปล่า
    const pt = mascot ? propTex[mascot.kind] : undefined;
    const release = MathUtils.clamp((p - 0.5) / 0.08, 0, 1);
    prop.current.visible = !!pt && release < 1;
    if (pt) {
      if (propMat.current.map !== pt) {
        propMat.current.map = pt;
        propMat.current.needsUpdate = true;
      }
      propMat.current.opacity = 1 - release;
      prop.current.position.y = HEIGHT + 0.02 + hop + release * 0.08;
      prop.current.scale.setScalar(PROP_SIZE * pop * (1 + release * 1.5));
    }
  });

  return <group ref={root} visible={false}>
    <Billboard lockX lockZ>
      <mesh ref={body} raycast={() => null}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={mat} map={run} transparent alphaTest={0.5} toneMapped={false} side={2} />
      </mesh>
      <mesh ref={prop} visible={false} raycast={() => null}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={propMat} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </Billboard>
    {/* เงาใต้เท้า */}
    <mesh rotation-x={-Math.PI / 2} position-y={0.002} raycast={() => null}>
      <circleGeometry args={[0.04, 20]} />
      <meshBasicMaterial color="#000" transparent opacity={0.18} depthWrite={false} />
    </mesh>
  </group>;
}

/** น้ำหยดจากรูรั่วลงพื้นขณะ tank.leakLph > 0 */
function LeakDrip() {
  const leaking = useLabStore((s) => (s.snapshot?.tank.leakLph ?? 0) > 0);
  if (!leaking) return null;
  const fall = HOLE[1] - FLOOR_Y;
  return <group raycast={() => null}>
    <mesh position={[HOLE[0], HOLE[1] - fall / 2, HOLE[2] + 0.004]}>
      <cylinderGeometry args={[0.0025, 0.004, fall, 8]} />
      <meshStandardMaterial color="#9de1fa" transparent opacity={0.65} roughness={0.15} depthWrite={false} />
    </mesh>
    <mesh rotation-x={-Math.PI / 2} position={[HOLE[0] + 0.01, FLOOR_Y + 0.002, HOLE[2] + 0.03]}>
      <circleGeometry args={[0.055, 24]} />
      <meshStandardMaterial color="#7fcbe8" transparent opacity={0.55} roughness={0.1} depthWrite={false} />
    </mesh>
  </group>;
}

export function Mascot() {
  return <>
    <Suspense fallback={null}><MascotSprite /></Suspense>
    <LeakDrip />
  </>;
}
