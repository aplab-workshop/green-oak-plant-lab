import { approach, clamp } from '../math';

/** รวม Water/Root ด้วย max เพื่อไม่หักผลจากสาเหตุเดียวกันซ้ำ */
export function combinedStress(waterStress: number, lightStress: number, nutrientStress: number, rootHealth: number) {
  const waterRoot = Math.max(clamp(waterStress, 0, 1), 1 - clamp(rootHealth, 0, 1));
  const light = clamp(lightStress, 0, 1);
  const nutrient = clamp(nutrientStress, 0, 1);
  return {
    maximum: Math.max(waterRoot, light, nutrient),
    growthFactor: (1 - waterRoot) * (1 - light) * (1 - nutrient),
  };
}

/** Stress สะสม/ฟื้นด้วยเวลาจำลอง ไม่กระโดดตาม Input ทันที (ARCHITECTURE § 11) */
export function stepStress(stress: number, target: number, dtS: number, riseH: number, recoveryH: number): number {
  const current = clamp(stress, 0, 1);
  const goal = clamp(target, 0, 1);
  return clamp(approach(current, goal, dtS, (goal > current ? riseH : recoveryH) * 3600), 0, 1);
}
