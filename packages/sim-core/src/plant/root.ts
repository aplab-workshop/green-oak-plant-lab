import type { SimConfig } from '../config/defaultConfig';
import { approach, clamp } from '../math';
import { rootSupplyRatio } from './water';

/** Root Health มีความจำของ Exposure; น้ำไม่ถึงรากใช้ Air Pump ชดเชยไม่ได้ */
export function stepRootHealth(
  health: number, oxygen: number, submerged: number, dtS: number, cfg: SimConfig,
): number {
  const current = clamp(health, 0, 1);
  const target = Math.min(rootSupplyRatio(submerged, cfg), clamp(oxygen / cfg.root.healthyOxygen, 0, 1));
  const tauH = target < current ? cfg.root.healthDeclineH : cfg.root.healthRecoveryH;
  return clamp(approach(current, target, dtS, tauH * 3600), 0, 1);
}
