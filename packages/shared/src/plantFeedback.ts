import { sensorStatus } from './sensorRanges';
import type { GrowthStage, PlantState } from './types';

/**
 * Plant feedback (SPEC § 4.10) — อ่าน State อย่างเดียว ไม่คำนวณพืช
 * ใช้ร่วมกันระหว่างฉาก 3D, แผงต้นผัก และข้อความผู้ช่วย
 */

export type PlantMood = 'happy' | 'ok' | 'worried' | 'sick' | 'dead';
export type PlantCause = 'water' | 'root' | 'dryAir' | 'light' | 'ph' | 'nutrient' | 'humidAir' | 'dark';
export type AirComfort = 'dry' | 'ok' | 'humid';

export const MOOD_EMOJI: Record<PlantMood, string> = { happy: '😄', ok: '🙂', worried: '😟', sick: '😵', dead: '💀' };

export const CAUSE_INFO: Record<PlantCause, { icon: string; label: string }> = {
  water: { icon: '💧', label: 'ขาดน้ำ' },
  root: { icon: '🫧', label: 'รากหายใจไม่ออก' },
  dryAir: { icon: '🏜️', label: 'อากาศแห้ง (VPD สูง) โตช้า' },
  humidAir: { icon: '💦', label: 'อากาศชื้นจัด (VPD ต่ำ) ลำเลียงธาตุอาหารได้น้อย' },
  light: { icon: '🔥', label: 'แสงมาก/เปิดไฟนานเกิน' },
  ph: { icon: '⚗️', label: 'pH ไม่เหมาะ ดูดปุ๋ยไม่ได้' },
  nutrient: { icon: '🧪', label: 'ปุ๋ยไม่พอดี (EC)' },
  dark: { icon: '🌑', label: 'มืดเกินไป ไม่ได้แสง' },
};

export const STAGE_CELEBRATION: Record<GrowthStage, string> = {
  seedling: '🎉 งอกแล้ว!',
  vegetative: '🎉 ใบอ่อน!',
  harvest: '🎉 พร้อมเก็บ!',
};

/** ชั่วโมงแสงสะสมที่ผู้ช่วยเริ่มเตือนให้พักไฟ (ก่อนเกิด Photoperiod stress ที่ 18 ชม. ใน Config, P30) */
export const LIGHT_LOAD_WARN_H = 16;
/** ชั่วโมงแสงสะสมที่เริ่มเกิด Photoperiod stress — ตรงกับ cfg.light.photoperiodMaxH ค่าเริ่ม (P30/P31) */
export const LIGHT_LOAD_STRESS_H = 18;
/** VPD ที่ถือว่าแห้ง / ชื้นจัด (kPa) — ตรงกับ cfg.airStress ค่าเริ่ม (P33) */
export const AIR_DRY_VPD = 1.7;
export const AIR_HUMID_VPD = 0.5;
export const AIR_COMFORT_LABEL: Record<AirComfort, string> = { dry: 'แห้ง', ok: 'เหมาะสม', humid: 'ชื้นจัด' };

/** VPD → คำที่ผู้เล่นเข้าใจ (P33) */
export const airComfort = (vpdKPa: number): AirComfort => (vpdKPa > AIR_DRY_VPD ? 'dry' : vpdKPa < AIR_HUMID_VPD ? 'humid' : 'ok');

/** Stress ขั้นต่ำที่นับเป็นสาเหตุ */
export const CAUSE_STRESS_MIN = 0.25;
/** PPFD ที่ต้นต่ำกว่านี้ตอนกลางวัน = มืด */
export const DARK_PPFD = 50;
/** แสดงป้าย "+g เมื่อวาน" ช่วงต้นวันจำลอง (นาที) */
export const GAIN_BADGE_MINUTES = 180;
/** ระยะเวลาฉลองเปลี่ยนระยะ (วินาทีจำลอง) */
export const CELEBRATION_S = 3 * 3600;

/** กลางวันตามเวลาจำลอง 06:00–22:00 (ตรงกับสูตรดูแลใน GAME-GUIDE) */
export const isDaytime = (minuteOfDay: number): boolean => minuteOfDay >= 360 && minuteOfDay < 1320;

/** ต้นตาย = Damage ≥ 1 หรืออยู่ใน deadPlantIds (Server อาจยังไม่ประกาศตายในรอบที่จบแล้ว) */
export const isPlantDead = (p: Pick<PlantState, 'id' | 'damage'>, deadPlantIds: readonly number[] = []): boolean =>
  p.damage >= 1 || deadPlantIds.includes(p.id);

export function plantMood(p: Pick<PlantState, 'health' | 'damage'>, dead = false): PlantMood {
  if (dead || p.damage >= 1) return 'dead';
  if (p.health >= 85) return 'happy';
  if (p.health >= 65) return 'ok';
  if (p.health >= 40) return 'worried';
  return 'sick';
}

/** สาเหตุหลักของต้นที่ยังไม่ตาย: Stress สูงสุด ≥ เกณฑ์ (ค่าเท่ากันเรียง น้ำ → ราก → อากาศแห้ง → แสง → ปุ๋ย/pH → ชื้นจัด), มิฉะนั้นมืด หรือไม่มี */
export function plantCause(
  p: Pick<PlantState, 'waterStress' | 'rootHealth' | 'lightStress' | 'nutrientStress' | 'ppfd' | 'damage'> &
    Partial<Pick<PlantState, 'dryAirStress' | 'humidAirStress'>>,
  /** ignorePh: ด่านที่ pH ไม่มีผล (P44) — Nutrient stress มาจาก EC จึงไม่บอกว่าเป็น pH */
  env: { ph: number; minuteOfDay: number; ignorePh?: boolean },
): PlantCause | null {
  if (p.damage >= 1) return null;
  const candidates: [PlantCause, number][] = [
    ['water', p.waterStress],
    ['root', 1 - p.rootHealth],
    ['dryAir', p.dryAirStress ?? 0],
    ['light', p.lightStress],
    [env.ignorePh || sensorStatus('ph', env.ph) === 'ok' ? 'nutrient' : 'ph', p.nutrientStress],
    ['humidAir', p.humidAirStress ?? 0],
  ];
  let best: [PlantCause, number] | null = null;
  for (const c of candidates) if (c[1] >= CAUSE_STRESS_MIN && (!best || c[1] > best[1])) best = c;
  if (best) return best[0];
  if (isDaytime(env.minuteOfDay) && p.ppfd < DARK_PPFD) return 'dark';
  return null;
}

/** ป้าย "+g เมื่อวาน" แสดงช่วงต้นวันจำลองเท่านั้น */
export const showGainBadge = (p: Pick<PlantState, 'gainYesterdayG'>, minuteOfDay: number): boolean =>
  p.gainYesterdayG !== null && minuteOfDay < GAIN_BADGE_MINUTES;

/** ฉลองเปลี่ยนระยะภายใน 3 ชั่วโมงจำลอง (ไม่ฉลองถ้าตายแล้ว) */
export const isCelebrating = (p: Pick<PlantState, 'stageChangedAtS' | 'damage'>, simTimeS: number): boolean =>
  p.stageChangedAtS !== null && p.damage < 1 && simTimeS >= p.stageChangedAtS && simTimeS - p.stageChangedAtS < CELEBRATION_S;
