import { approach, clamp } from '../math';

/** Stress สะสม/ฟื้นด้วยเวลาจำลอง ไม่กระโดดตาม Input ทันที (ARCHITECTURE § 11) */
export function stepStress(stress: number, target: number, dtS: number, riseH: number, recoveryH: number): number {
  const current = clamp(stress, 0, 1);
  const goal = clamp(target, 0, 1);
  return clamp(approach(current, goal, dtS, (goal > current ? riseH : recoveryH) * 3600), 0, 1);
}
