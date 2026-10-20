import type { PlantState } from '@gol/shared';

/**
 * แถบ Stamina ของต้นผัก (SPEC § 4.11) — Pure: แปลง State จาก Server เป็นแถบ "ค่ามาก = ดี"
 */

export type StaminaLevel = 'ok' | 'low' | 'critical' | 'dead';

export interface StaminaBar {
  key: 'health' | 'water' | 'nutrient' | 'light' | 'root' | 'toughness';
  icon: string;
  label: string;
  /** 0–1 */
  value: number;
  color: string;
  level: StaminaLevel;
  hint: string;
}

const RED = '#dc2626';
const AMBER = '#f59e0b';
const GREY = '#94a3b8';
const LOW = 0.6;
const CRITICAL = 0.3;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** ต้นตาย = อยู่ใน deadPlantIds หรือ Damage ≥ 1 (Server อาจยังไม่ประกาศตายในรอบที่จบแล้ว) */
export const isPlantDead = (p: Pick<PlantState, 'id' | 'damage'>, deadPlantIds: readonly number[] = []): boolean =>
  p.damage >= 1 || deadPlantIds.includes(p.id);

const DEFS: { key: StaminaBar['key']; icon: string; label: string; color: string; hint: string; read: (p: PlantState) => number }[] = [
  { key: 'health', icon: '❤️', label: 'Health', color: RED, hint: 'สุขภาพรวม = ความแข็งแรง × ผลของ Stress สูงสุด', read: (p) => p.health / 100 },
  { key: 'water', icon: '💧', label: 'น้ำในต้น', color: '#0ea5e9', hint: 'Hydration — ลดลงเมื่อรากพ้นน้ำหรือดูดน้ำไม่ทัน', read: (p) => p.hydration },
  { key: 'nutrient', icon: '🧪', label: 'ปุ๋ย', color: '#eab308', hint: '100% − Nutrient stress — EC หรือ pH นอกช่วงทำให้ลดลง', read: (p) => 1 - p.nutrientStress },
  { key: 'light', icon: '☀️', label: 'แสงพอดี', color: '#f97316', hint: '100% − Light stress — แสงแรงเกินร่วมกับความร้อน/ขาดน้ำทำให้ลดลง', read: (p) => 1 - p.lightStress },
  { key: 'root', icon: '🫧', label: 'ราก', color: '#06b6d4', hint: 'Root health — ต้องการน้ำถึงรากและ Oxygen (ปั๊มลม)', read: (p) => p.rootHealth },
  { key: 'toughness', icon: '🛡️', label: 'ความแข็งแรง', color: '#16a34a', hint: '100% − Damage สะสม — ลดแล้วไม่ฟื้น', read: (p) => 1 - p.damage },
];

export function staminaBars(p: PlantState, dead: boolean): StaminaBar[] {
  return DEFS.map((d) => {
    const value = clamp01(d.read(p));
    const level: StaminaLevel = dead ? 'dead' : value < CRITICAL ? 'critical' : value < LOW ? 'low' : 'ok';
    const color = level === 'dead' ? GREY : level === 'critical' ? RED : level === 'low' ? AMBER : d.color;
    return { key: d.key, icon: d.icon, label: d.label, value, color, level, hint: d.hint };
  });
}
