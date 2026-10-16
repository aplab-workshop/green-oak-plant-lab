import type { SimConfig } from '../config/defaultConfig';
import { SECONDS_PER_DAY } from '../clock';
import { clamp } from '../math';
import { dliIncrement, positionFactor, ppfdAt } from '../environment/light';
import { morphology, stepBiomass, type GrowthStage } from './growth';
import {
  rootSubmergedFraction,
  rootSupplyRatio,
  stepDamage,
  stepHydration,
  transpirationFactor,
  waterDemandLPerDay,
  waterStress,
} from './water';

/** State ของผักแต่ละต้น (FR-20) */
export interface PlantState {
  id: number;
  /** ตำแหน่ง Net Pot (index ใน cfg.light.positionFactors) */
  position: number;
  ageDays: number;
  stage: GrowthStage;
  /** Fresh weight โดยประมาณ (g) */
  biomassG: number;
  leafCount: number;
  leafAreaCm2: number;
  rootLengthCm: number;
  /** 0 = แห้งสนิท, 1 = เต็มที่ */
  hydration: number;
  /** 0–1 */
  waterStress: number;
  /** 0–1 (M2) */
  lightStress: number;
  /** 0–1 (M2) */
  nutrientStress: number;
  /** 0–1, 1 = ปกติ (M2) */
  rootHealth: number;
  /** ความเสียหายถาวร 0–1 */
  damage: number;
  /** 0–100 */
  health: number;
  // --- ค่าวินิจฉัย (ใช้แสดงผลและอธิบาย) ---
  /** สัดส่วนรากที่แช่น้ำ 0–1 */
  rootSubmerged: number;
  /** ความสามารถดูดน้ำเทียบความต้องการ 0–1 */
  supplyRatio: number;
  /** ความต้องการน้ำปัจจุบัน (L/day) */
  demandLPerDay: number;
  ppfd: number;
  dliToday: number;
  dliYesterday: number;
}

/** สภาพแวดล้อมที่ต้นได้รับใน step นี้ */
export interface PlantEnvironment {
  simTimeS: number;
  waterHeightCm: number;
  ledPct: number;
  airTempC: number;
  vpdKPa: number;
}

export function createPlant(id: number, position: number, biomassG: number, simTimeS: number, cfg: SimConfig): PlantState {
  const m = morphology(biomassG, cfg);
  return {
    id,
    position,
    ageDays: simTimeS / SECONDS_PER_DAY,
    stage: m.stage,
    biomassG,
    leafCount: m.leafCount,
    leafAreaCm2: m.leafAreaCm2,
    rootLengthCm: m.rootLengthCm,
    hydration: 1,
    waterStress: 0,
    lightStress: 0,
    nutrientStress: 0,
    rootHealth: 1,
    damage: 0,
    health: 100,
    rootSubmerged: 1,
    supplyRatio: 1,
    demandLPerDay: 0,
    ppfd: 0,
    dliToday: 0,
    dliYesterday: 0,
  };
}

/** ความต้องการน้ำและความสามารถดูดน้ำของต้น ณ สภาพปัจจุบัน */
export interface PlantWaterRequest {
  demandLPerDay: number;
  rootSubmerged: number;
  supplyRatio: number;
  factor: number;
  ppfd: number;
}

export function plantWaterRequest(p: PlantState, e: PlantEnvironment, cfg: SimConfig): PlantWaterRequest {
  const ppfd = ppfdAt(e.ledPct, positionFactor(p.position, cfg), cfg);
  const factor = transpirationFactor(e.vpdKPa, ppfd, cfg);
  const rootSubmerged = rootSubmergedFraction(e.waterHeightCm, p.rootLengthCm, cfg);
  return {
    demandLPerDay: waterDemandLPerDay(p.leafAreaCm2, factor, cfg),
    rootSubmerged,
    supplyRatio: rootSupplyRatio(rootSubmerged, cfg),
    factor,
    ppfd,
  };
}

/** Health = 100 · (1 − Damage) · (1 − 0.5·S_w) — M2 จะรวม Stress อื่น */
export const healthScore = (damage: number, stress: number): number =>
  100 * (1 - clamp(damage, 0, 1)) * (1 - 0.5 * clamp(stress, 0, 1));

/**
 * เดินต้นไม้ 1 step (Pure)
 * @param tankFactor สัดส่วนน้ำที่ถังจ่ายได้จริงเทียบที่ขอ (< 1 เมื่อถังเกือบแห้ง)
 */
export function stepPlant(
  p: PlantState,
  req: PlantWaterRequest,
  e: PlantEnvironment,
  tankFactor: number,
  dtS: number,
  cfg: SimConfig,
): PlantState {
  const supplyRatio = req.supplyRatio * clamp(tankFactor, 0, 1);
  const hydration = stepHydration(p.hydration, supplyRatio, req.factor, p.damage, dtS, cfg);
  const stress = waterStress(hydration, cfg);
  const damage = stepDamage(p.damage, stress, dtS, cfg);
  const biomassG = stepBiomass(
    p.biomassG,
    { ppfd: req.ppfd, airTempC: e.airTempC, waterStress: stress, damage },
    dtS,
    cfg,
  );
  const m = morphology(biomassG, cfg);

  const crossesMidnight =
    Math.floor((e.simTimeS + dtS) / SECONDS_PER_DAY) !== Math.floor(e.simTimeS / SECONDS_PER_DAY);
  const inc = dliIncrement(req.ppfd, dtS);

  return {
    ...p,
    ageDays: (e.simTimeS + dtS) / SECONDS_PER_DAY,
    stage: m.stage,
    biomassG,
    leafCount: m.leafCount,
    leafAreaCm2: m.leafAreaCm2,
    // รากไม่หดสั้นลง
    rootLengthCm: Math.max(p.rootLengthCm, m.rootLengthCm),
    hydration,
    waterStress: stress,
    damage,
    health: healthScore(damage, stress),
    rootSubmerged: req.rootSubmerged,
    supplyRatio,
    demandLPerDay: req.demandLPerDay,
    ppfd: req.ppfd,
    dliToday: crossesMidnight ? 0 : p.dliToday + inc,
    dliYesterday: crossesMidnight ? p.dliToday + inc : p.dliYesterday,
  };
}
