import type { SimConfig } from '../config/defaultConfig';
import { clamp } from '../math';

/**
 * Plant Water model (ARCHITECTURE.md § 7.4)
 * เป็น Educational Simulation — สมการอธิบายได้ พารามิเตอร์อยู่ใน cfg.plant
 */

/**
 * สัดส่วนความยาวรากที่แช่น้ำ (FR-22)
 *   ความลึกแนวดิ่งจำกัดที่พื้นถัง; ความยาวส่วนเกินถือว่าโค้ง ไม่วางปลายรากใต้พื้น
 */
export function rootSubmergedFraction(waterHeightCm: number, rootLengthCm: number, cfg: SimConfig): number {
  const pot = cfg.tank.potBottomCm;
  if (waterHeightCm <= 0) return 0;
  if (rootLengthCm <= 0) return waterHeightCm >= pot ? 1 : 0;
  const depth = Math.min(rootLengthCm, pot);
  if (depth <= 0) return 0;
  const tip = pot - depth;
  return clamp((waterHeightCm - tip) / depth, 0, 1);
}

/** ความสามารถดูดน้ำ r = min(1, f_sub / f_crit) */
export const rootSupplyRatio = (submergedFraction: number, cfg: SimConfig): number =>
  clamp(submergedFraction / cfg.plant.rootCriticalFraction, 0, 1);

/**
 * ตัวคูณ Transpiration เทียบสภาวะอ้างอิง (VPD 1 kPa, PPFD อ้างอิง)
 *   √(VPD/1) · (dark + (1 − dark)·PPFD/PPFD_ref)
 */
export function transpirationFactor(vpdKPa: number, ppfd: number, cfg: SimConfig): number {
  const p = cfg.plant;
  const dark = p.transpirationDarkFraction;
  return Math.sqrt(Math.max(0, vpdKPa)) * (dark + (1 - dark) * (Math.max(0, ppfd) / p.transpirationRefPpfd));
}

/** Water demand ของต้น (L/day) = k_T · LA(m²) · factor */
export const waterDemandLPerDay = (leafAreaCm2: number, factor: number, cfg: SimConfig): number =>
  cfg.plant.transpirationLPerM2Day * (leafAreaCm2 / 1e4) * factor;

/** Hydration สูงสุดที่ฟื้นได้หลังเกิด Damage */
export const hydrationCap = (damage: number, cfg: SimConfig): number =>
  1 - cfg.plant.damageHydrationCapFactor * clamp(damage, 0, 1);

/**
 * Hydration dynamics
 *   dH/dt = −k_loss·(1 − r)·factor + k_rec·r·(H_cap − H)
 * factor = transpirationFactor (ขาดน้ำตอนแดดจัด/อากาศแห้งจะเหี่ยวเร็วกว่า)
 */
export function stepHydration(
  hydration: number,
  supplyRatio: number,
  factor: number,
  damage: number,
  dtS: number,
  cfg: SimConfig,
): number {
  const p = cfg.plant;
  const dtH = dtS / 3600;
  const r = clamp(supplyRatio, 0, 1);
  const loss = p.hydrationLossPerH * (1 - r) * factor;
  const recovery = p.hydrationRecoveryPerH * r * (hydrationCap(damage, cfg) - hydration);
  return clamp(hydration + (recovery - loss) * dtH, 0, 1);
}

/** Water stress S_w = clamp((1 − H) / (1 − H_wilt), 0, 1) */
export const waterStress = (hydration: number, cfg: SimConfig): number =>
  clamp((1 - hydration) / (1 - cfg.plant.wiltHydration), 0, 1);

/**
 * Accumulated damage (FR-24) — เพิ่มอย่างเดียว ไม่มีเทอมลด
 *   dD/dt = k_dmg · max(0, S_w − S_threshold)
 */
export function stepDamage(damage: number, stress: number, dtS: number, cfg: SimConfig): number {
  const p = cfg.plant;
  const excess = Math.max(0, stress - p.damageStressThreshold);
  return clamp(damage + p.damagePerH * excess * (dtS / 3600), 0, 1);
}
