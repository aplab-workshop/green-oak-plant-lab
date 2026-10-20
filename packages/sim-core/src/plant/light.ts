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

/** P30: ชั่วโมงแสงสะสมที่ยังไม่ได้พัก — ไฟแรงสะสมเร็ว หรี่ไฟสะสมช้า มืด/หรี่มากล้างออก */
export function stepLightLoad(loadH: number, ppfd: number, dtS: number, cfg: SimConfig): number {
  const c = cfg.light;
  const dtH = dtS / 3600;
  const next = ppfd >= c.restPpfd
    ? loadH + dtH * Math.min(1, ppfd / c.loadRefPpfd)
    : loadH - dtH * c.restRecoveryPerH * (1 - Math.max(0, ppfd) / c.restPpfd);
  return clamp(next, 0, c.lightLoadMaxH);
}

/** P30: Stress จากเปิดไฟนานเกิน (มีเพดานต่ำกว่าเกณฑ์ Damage) */
export function photoperiodStressTarget(loadH: number, cfg: SimConfig): number {
  const c = cfg.light;
  return clamp((loadH - c.photoperiodMaxH) / c.photoperiodSpanH, 0, 1) * c.photoperiodMaxStress;
}

export function stepLightStress(
  stress: number, ppfd: number, airTempC: number, hydration: number, dtS: number, cfg: SimConfig, lightLoadH = 0,
): number {
  const target = Math.max(lightStressTarget(ppfd, airTempC, hydration, cfg), photoperiodStressTarget(lightLoadH, cfg));
  return stepStress(stress, target, dtS, cfg.light.stressRiseH, cfg.light.stressRecoveryH);
}
