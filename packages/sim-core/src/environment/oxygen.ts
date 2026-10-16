import type { SimConfig } from '../config/defaultConfig';
import { approach, clamp } from '../math';

/** ดัชนี Estimated Oxygen Status ไม่ใช่ความเข้มข้น DO (mg/L) */
export function oxygenTarget(airPump: boolean, waterTempC: number, waterLevelPct: number, cfg: SimConfig): number {
  const c = cfg.root;
  const thermal = clamp(1 - Math.max(0, waterTempC - c.oxygenTempRefC) / c.oxygenTempSpanC, 0, 1);
  const water = clamp(waterLevelPct / c.oxygenMinLevelPct, 0, 1);
  return clamp((airPump ? c.oxygenOnTarget : c.oxygenOffTarget) * thermal * water, 0, 1);
}

export function stepOxygen(
  oxygen: number, airPump: boolean, waterTempC: number, waterLevelPct: number, dtS: number, cfg: SimConfig,
): number {
  const current = clamp(oxygen, 0, 1);
  const target = oxygenTarget(airPump, waterTempC, waterLevelPct, cfg);
  const tauH = target > current ? cfg.root.oxygenRiseH : cfg.root.oxygenFallH;
  return clamp(approach(current, target, dtS, tauH * 3600), 0, 1);
}
