import { approach, clamp } from '../math';

/**
 * รวม Stress ด้วย max ภายในกลุ่มสาเหตุเดียวกันเพื่อไม่หักซ้ำ:
 *   กลุ่มน้ำ = Water / Root / อากาศแห้ง (P33), กลุ่มธาตุอาหาร = Nutrient / อากาศชื้นจัด (P33)
 */
export function combinedStress(
  waterStress: number, lightStress: number, nutrientStress: number, rootHealth: number,
  dryAirStress = 0, humidAirStress = 0,
) {
  const waterRoot = Math.max(clamp(waterStress, 0, 1), 1 - clamp(rootHealth, 0, 1), clamp(dryAirStress, 0, 1));
  const light = clamp(lightStress, 0, 1);
  const nutrient = Math.max(clamp(nutrientStress, 0, 1), clamp(humidAirStress, 0, 1));
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
