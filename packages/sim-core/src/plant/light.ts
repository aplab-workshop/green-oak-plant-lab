import type { SimConfig } from '../config/defaultConfig';
import { clamp } from '../math';
import { stepStress } from './stress';

/** ความร้อน/ขาดน้ำขยายผลของแสงเกินเกณฑ์ แต่ความมืดไม่สร้าง Light Stress */
export function lightStressTarget(ppfd: number, airTempC: number, hydration: number, cfg: SimConfig): number {
  const c = cfg.light;
  const exposure = clamp((ppfd - c.stressStartPpfd) / (c.stressFullPpfd - c.stressStartPpfd), 0, 1);
  const heat = clamp((airTempC - c.stressHeatStartC) / c.stressHeatSpanC, 0, 1);
  return clamp(exposure * (1 + c.stressHeatGain * heat + c.stressWaterGain * (1 - clamp(hydration, 0, 1))), 0, 1);
}

export function stepLightStress(
  stress: number, ppfd: number, airTempC: number, hydration: number, dtS: number, cfg: SimConfig,
): number {
  return stepStress(stress, lightStressTarget(ppfd, airTempC, hydration, cfg), dtS,
    cfg.light.stressRiseH, cfg.light.stressRecoveryH);
}
