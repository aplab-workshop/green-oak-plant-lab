/**
 * จัดใบเป็นทรงพุ่ม Rosette (Pure function — ทดสอบได้)
 * ใบนอก = ใบแก่ ใหญ่และเอนต่ำ, ใบใน = ใบอ่อน เล็กและตั้งชัน
 */

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const DEG = Math.PI / 180;

/** ความยาวใบของต้นกล้า 5 g (m) */
export const BASE_LEAF_LENGTH = 0.06;

export interface LeafPose {
  /** มุมรอบแกนตั้ง (rad) */
  yaw: number;
  /** มุมเงยจากแนวนอน (rad) — ติดลบ = ห้อยลง */
  elevation: number;
  length: number;
  width: number;
  /** ระยะออกจากกลางต้น (m) */
  radialOffset: number;
  /** ยอดอ่อนสูงกว่าวงใบนอก เพื่อให้เห็นทรงพุ่ม */
  lift: number;
}

/** ค่าสุ่มแบบคงที่ 0…1 จาก (plantId, i) */
export function hash01(a: number, b: number): number {
  let h = Math.imul(a * 374761393 + b * 668265263, 1274126177) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function leafLayout(plantId: number, leafCount: number, scale: number, droop: number): LeafPose[] {
  const n = Math.max(1, Math.round(leafCount));
  const poses: LeafPose[] = [];
  const yaw0 = hash01(plantId, 999) * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    // rank: 0 = ใบนอกสุด (แก่สุด), 1 = ใบในสุด (อ่อนสุด)
    const r = n === 1 ? 1 : i / (n - 1);
    const jitter = hash01(plantId, i) - 0.5;
    const length = BASE_LEAF_LENGTH * scale * (1 - 0.22 * r) * (1 + 0.15 * jitter);
    const baseElev = (40 + 40 * r + 8 * jitter) * DEG;
    // ใบตก: ใบนอกห้อยลงได้มากกว่าใบใน
    const drop = droop * (baseElev + (35 - 25 * r) * DEG);
    poses.push({
      yaw: yaw0 + i * GOLDEN_ANGLE,
      elevation: baseElev - drop,
      length,
      width: length * (0.95 + 0.12 * jitter),
      radialOffset: 0.004 * (1 - r) * scale,
      lift: 0.018 * r * scale * (1 - droop),
    });
  }
  return poses;
}
