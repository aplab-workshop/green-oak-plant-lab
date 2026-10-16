import type { SimConfig } from '../config/defaultConfig';
import { clamp } from '../math';

/**
 * Growth baseline (ARCHITECTURE.md § 7.5) — M1 เป็น Logistic อย่างง่าย, M2 จะปรับปรุง
 *   dB/dt = μ·B·(1 − B/B_max)·f_light·f_temp·(1 − S_w)·(1 − Damage)
 */

export type GrowthStage = 'seedling' | 'vegetative' | 'harvest';

/** f_light = (P/(P+K)) / (P_ref/(P_ref+K)), clamp 0…max */
export function lightFactor(ppfd: number, cfg: SimConfig): number {
  const { lightHalfSatPpfd: k, lightRefPpfd: ref, lightFactorMax } = cfg.plant;
  const p = Math.max(0, ppfd);
  return clamp(p / (p + k) / (ref / (ref + k)), 0, lightFactorMax);
}

/** f_temp แบบ Trapezoid: 0 ที่ min, 1 ช่วง optLow–optHigh, 0 ที่ max */
export function temperatureFactor(tempC: number, cfg: SimConfig): number {
  const [tMin, tLow, tHigh, tMax] = cfg.plant.tempCardinalC;
  if (tempC <= tMin || tempC >= tMax) return 0;
  if (tempC < tLow) return (tempC - tMin) / (tLow - tMin);
  if (tempC > tHigh) return (tMax - tempC) / (tMax - tHigh);
  return 1;
}

export interface GrowthInput {
  ppfd: number;
  airTempC: number;
  waterStress: number;
  damage: number;
}

/** Biomass ใหม่หลัง dt (ไม่ลดลง) */
export function stepBiomass(biomassG: number, u: GrowthInput, dtS: number, cfg: SimConfig): number {
  const p = cfg.plant;
  const rate =
    p.growthRatePerDay *
    biomassG *
    Math.max(0, 1 - biomassG / p.maxBiomassG) *
    lightFactor(u.ppfd, cfg) *
    temperatureFactor(u.airTempC, cfg) *
    (1 - clamp(u.waterStress, 0, 1)) *
    (1 - clamp(u.damage, 0, 1));
  return biomassG + rate * (dtS / 86_400);
}

/** ลักษณะที่คำนวณจาก Biomass */
export interface Morphology {
  leafAreaCm2: number;
  leafCount: number;
  rootLengthCm: number;
  stage: GrowthStage;
}

export function morphology(biomassG: number, cfg: SimConfig): Morphology {
  const p = cfg.plant;
  return {
    leafAreaCm2: p.leafAreaPerG * biomassG,
    leafCount: 4 + Math.round(1.2 * biomassG ** 0.6),
    rootLengthCm: p.rootBaseCm + p.rootGainCm * (1 - Math.exp(-biomassG / p.rootBiomassScaleG)),
    stage: biomassG < p.vegetativeAtG ? 'seedling' : biomassG < p.harvestAtG ? 'vegetative' : 'harvest',
  };
}
