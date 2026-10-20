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
  /** ต้นตาย (Damage ≥ 1) → ใบตก สีน้ำตาลเข้ม และเอนล้ม (P25) */
  dead: boolean;
}

type Rgb = [number, number, number];

const EMERALD: Rgb = [119, 184, 43];
const YELLOW_GREEN: Rgb = [176, 178, 64];
const BROWN: Rgb = [133, 94, 54];
/** ขาดปุ๋ย/pH ไม่เหมาะ → เหลืองซีด (Chlorosis) */
const PALE_YELLOW: Rgb = [214, 201, 92];
/** แสงแรง/ร้อน → ซีดขาว */
const BLEACHED: Rgb = [206, 214, 168];
const DEAD_BROWN: Rgb = [92, 62, 38];

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => a[i]! + (b[i]! - a[i]!) * t) as Rgb;
const hex = (c: Rgb) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * สีใบ: เขียว → เหลืองเขียว (Water) → เหลืองซีด (Nutrient/pH) → ซีดขาว (Light) → น้ำตาล (Damage)
 * แต่ละ Stress ผสมตามค่าของตัวเอง ทำให้สาเหตุต่างกันดูต่างกัน (P25)
 */
export function leafColor(waterStress: number, damage: number, nutrientStress = 0, lightStress = 0): string {
  if (damage >= 1) return hex(DEAD_BROWN);
  let c = mix(EMERALD, YELLOW_GREEN, clamp01(waterStress) * 0.7);
  c = mix(c, PALE_YELLOW, clamp01(nutrientStress) * 0.75);
  c = mix(c, BLEACHED, clamp01(lightStress) * 0.6);
  return hex(mix(c, BROWN, clamp01(damage * 1.4)));
}

export function plantVisuals(p: PlantState): PlantVisual {
  const dead = p.damage >= 1;
  const droop = dead ? 1 : clamp01(Math.max(p.waterStress, 0.8 * p.damage));
  return {
    droop,
    wilted: droop > 0.6,
    leafColor: leafColor(p.waterStress, p.damage, p.nutrientStress, p.lightStress),
    scale: Math.cbrt(Math.max(p.biomassG, 0.1) / 5),
    leafCount: p.leafCount,
    rootLengthCm: p.rootLengthCm,
    curl: clamp01(p.lightStress),
    dead,
  };
}

/** สีตาม Health score สำหรับป้าย/ชิป */
export function healthColor(health: number): string {
  if (health >= 80) return '#059669';
  if (health >= 50) return '#d97706';
  return '#dc2626';
}
