import type { SimConfig } from '../config/defaultConfig';
import { clamp } from '../math';
import { stepStress } from './stress';

/** ช่วงเหมาะสมเป็น Trapezoid; ต่ำ/สูงเกินช่วงให้ suitability = 0 */
function suitability(value: number, cardinal: [number, number, number, number]): number {
  const [min, low, high, max] = cardinal;
  if (value <= min || value >= max) return 0;
  if (value < low) return (value - min) / (low - min);
  if (value > high) return (max - value) / (max - high);
  return 1;
}

/** ปัจจัยจำกัดที่แย่ที่สุด ไม่บวก EC/pH ซ้ำ และไม่แก้ Salt mass */
export function nutrientStressTarget(ecMsCm: number, ph: number, cfg: SimConfig): number {
  return clamp(1 - Math.min(suitability(ecMsCm, cfg.nutrient.ecCardinalMsCm),
    suitability(ph, cfg.nutrient.phCardinal)), 0, 1);
}

export function stepNutrientStress(stress: number, ecMsCm: number, ph: number, dtS: number, cfg: SimConfig): number {
  return stepStress(stress, nutrientStressTarget(ecMsCm, ph, cfg), dtS,
    cfg.nutrient.stressRiseH, cfg.nutrient.stressRecoveryH);
}
