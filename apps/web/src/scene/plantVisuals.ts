import type { PlantState } from '@gol/shared';

/**
 * แปลง PlantState (จาก Server) → ค่าที่ใช้วาด (FR-53)
 * เป็น Pure function: การคำนวณพฤติกรรมพืชอยู่ใน sim-core เท่านั้น ส่วนนี้แค่ตีความเพื่อแสดงผล
 */
export interface PlantVisual {
  /** 0 = ใบตั้ง, 1 = ใบตกเต็มที่ */
  droop: number;
  /** ใบเหี่ยว (ห่อ/ยุบ) */
  wilted: boolean;
  /** สีใบ hex */
  leafColor: string;
  /** ขนาดสัมพัทธ์ ∝ ∛Biomass (1 = 5 g) */
  scale: number;
  leafCount: number;
  rootLengthCm: number;
  /** 0–1 (M2: Light stress) */
  curl: number;
}

type Rgb = [number, number, number];

const EMERALD: Rgb = [46, 158, 82];
const YELLOW_GREEN: Rgb = [176, 178, 64];
const BROWN: Rgb = [133, 94, 54];

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => a[i]! + (b[i]! - a[i]!) * t) as Rgb;
const hex = (c: Rgb) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** สีใบ: เขียว → เหลืองเขียว (Water stress) → น้ำตาล (Damage) */
export function leafColor(waterStress: number, damage: number): string {
  const stressed = mix(EMERALD, YELLOW_GREEN, clamp01(waterStress) * 0.7);
  return hex(mix(stressed, BROWN, clamp01(damage * 1.4)));
}

export function plantVisuals(p: PlantState): PlantVisual {
  const droop = clamp01(Math.max(p.waterStress, 0.8 * p.damage));
  return {
    droop,
    wilted: droop > 0.6,
    leafColor: leafColor(p.waterStress, p.damage),
    scale: Math.cbrt(Math.max(p.biomassG, 0.1) / 5),
    leafCount: p.leafCount,
    rootLengthCm: p.rootLengthCm,
    curl: clamp01(p.lightStress),
  };
}

/** สีตาม Health score สำหรับป้าย/ชิป */
export function healthColor(health: number): string {
  if (health >= 80) return '#059669';
  if (health >= 50) return '#d97706';
  return '#dc2626';
}
