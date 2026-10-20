import type { PlantState } from '@gol/shared';
import type { SimConfig } from '../config/defaultConfig';
import { SECONDS_PER_DAY } from '../clock';
import { clamp } from '../math';
import { dliIncrement, positionFactor, ppfdAt } from '../environment/light';
import { morphology, stepBiomass } from './growth';
import { stepLightLoad, stepLightStress } from './light';
import { stepAirStress } from './air';
import { growthEfficiency } from './growth';
import { stepNutrientStress } from './nutrient';
import { stepRootHealth } from './root';
import { combinedStress } from './stress';
import {
  rootSubmergedFraction,
  rootSupplyRatio,
  stepDamage,
  stepHydration,
  transpirationFactor,
  waterDemandLPerDay,
  waterStress,
} from './water';

/** State ของผักแต่ละต้น — นิยามใน @gol/shared เพื่อให้ Web ใช้ Type เดียวกัน */
export type { PlantState };

/** สภาพแวดล้อมที่ต้นได้รับใน step นี้ */
export interface PlantEnvironment {
  simTimeS: number;
  waterHeightCm: number;
  ledPct: number;
  airTempC: number;
  vpdKPa: number;
  /** ค่าจริงจาก Environment ก่อน Step (ไม่ผ่าน Sensor noise) */
  ecMsCm: number;
  ph: number;
  /** Estimated Oxygen Status [0,1] ของถังก่อน Step */
  estimatedOxygen: number;
  /** PPFD จากแดด (เท่ากันทุกตำแหน่ง) — P36; ไม่ระบุ = 0 */
  sunPpfd?: number;
  /** ปัจจัยที่ด่านนี้ไม่นับผลต่อผัก — P38 */
  ignore?: IgnoredFactors;
}

/** ปัจจัยที่ไม่มีผลต่อผักในด่าน (ผู้เล่นคุมไม่ได้) — P38 / SPEC § 4.21 */
export interface IgnoredFactors {
  temperature?: boolean;
  air?: boolean;
  nutrient?: boolean;
}

const NO_IGNORE: Readonly<IgnoredFactors> = Object.freeze({});
const NO_AIR_STRESS = Object.freeze({ dry: 0, humid: 0 });

/** อุณหภูมิที่เหมาะที่สุด = กลางช่วงที่โตเต็มที่ของ tempCardinalC */
export const optimalTempC = (cfg: SimConfig): number => (cfg.plant.tempCardinalC[1] + cfg.plant.tempCardinalC[2]) / 2;

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
    lightLoadH: 0,
    dryAirStress: 0,
    humidAirStress: 0,
    growthGPerH: 0,
    growthEfficiency: 0,
    biomassDayStartG: biomassG,
    gainYesterdayG: null,
    stageChangedAtS: null,
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
  if (p.damage >= 1) return { demandLPerDay: 0, rootSubmerged: p.rootSubmerged, supplyRatio: 0, factor: 0, ppfd: 0 };
  const ppfd = ppfdAt(e.ledPct, positionFactor(p.position, cfg), cfg) + (e.sunPpfd ?? 0);
  // P38: ด่านที่ไม่นับอุณหภูมิ/อากาศ ใช้ VPD อ้างอิง — อากาศที่คุมไม่ได้ไม่เปลี่ยนความต้องการน้ำ
  const vpd = e.ignore?.temperature || e.ignore?.air ? cfg.plant.referenceVpdKPa : e.vpdKPa;
  const factor = transpirationFactor(vpd, ppfd, cfg);
  const rootSubmerged = rootSubmergedFraction(e.waterHeightCm, p.rootLengthCm, cfg);
  return {
    demandLPerDay: waterDemandLPerDay(p.leafAreaCm2, factor, cfg),
    rootSubmerged,
    supplyRatio: rootSupplyRatio(rootSubmerged, cfg) * clamp(p.rootHealth, 0, 1),
    factor,
    ppfd,
  };
}

/** Health = 100 · (1 − Damage) · (1 − 0.5·maxStress) */
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
  if (p.damage >= 1) return { ...p, health: 0, demandLPerDay: 0, supplyRatio: 0, growthGPerH: 0, growthEfficiency: 0 };
  const supplyRatio = req.supplyRatio * clamp(tankFactor, 0, 1);
  const hydration = stepHydration(p.hydration, supplyRatio, req.factor, p.damage, dtS, cfg);
  const stress = waterStress(hydration, cfg);
  // P38: ปัจจัยที่ด่านคุมไม่ได้ไม่มีผลต่อผัก (สิ่งแวดล้อมจริงยังเปลี่ยนตามเดิม)
  const ignore = e.ignore ?? NO_IGNORE;
  const plantTempC = ignore.temperature ? optimalTempC(cfg) : e.airTempC;
  const lightLoadH = stepLightLoad(p.lightLoadH, req.ppfd, dtS, cfg);
  const lightStress = stepLightStress(p.lightStress, req.ppfd, plantTempC, hydration, dtS, cfg, lightLoadH);
  const nutrientStress = ignore.nutrient ? 0 : stepNutrientStress(p.nutrientStress, e.ecMsCm, e.ph, dtS, cfg);
  // P38: น้ำอุ่นจากอากาศที่คุมไม่ได้ไม่ทำให้รากขาดออกซิเจน
  const oxygen = ignore.temperature ? Math.max(e.estimatedOxygen, cfg.root.healthyOxygen) : e.estimatedOxygen;
  const rootHealth = stepRootHealth(p.rootHealth, oxygen, req.rootSubmerged, dtS, cfg);
  const air = ignore.air ? NO_AIR_STRESS : stepAirStress(p.dryAirStress, p.humidAirStress, e.vpdKPa, dtS, cfg);
  const maximum = combinedStress(stress, lightStress, nutrientStress, rootHealth, air.dry, air.humid).maximum;
  const damage = stepDamage(p.damage, maximum, dtS, cfg);
  const growthInput = { ppfd: req.ppfd, airTempC: plantTempC, waterStress: stress, lightStress, nutrientStress, rootHealth, damage,
    dryAirStress: air.dry, humidAirStress: air.humid };
  const biomassG = stepBiomass(p.biomassG, growthInput, dtS, cfg);
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
    lightStress,
    nutrientStress,
    rootHealth,
    damage,
    health: healthScore(damage, maximum),
    rootSubmerged: req.rootSubmerged,
    supplyRatio,
    demandLPerDay: damage >= 1 ? 0 : req.demandLPerDay,
    ppfd: req.ppfd,
    dliToday: crossesMidnight ? 0 : p.dliToday + inc,
    dliYesterday: crossesMidnight ? p.dliToday + inc : p.dliYesterday,
    lightLoadH,
    dryAirStress: air.dry,
    humidAirStress: air.humid,
    growthGPerH: dtS > 0 ? (biomassG - p.biomassG) * 3600 / dtS : p.growthGPerH,
    growthEfficiency: growthEfficiency(growthInput, cfg),
    biomassDayStartG: crossesMidnight ? biomassG : p.biomassDayStartG,
    gainYesterdayG: crossesMidnight ? biomassG - p.biomassDayStartG : p.gainYesterdayG,
    stageChangedAtS: m.stage !== p.stage ? e.simTimeS + dtS : p.stageChangedAtS,
  };
}
