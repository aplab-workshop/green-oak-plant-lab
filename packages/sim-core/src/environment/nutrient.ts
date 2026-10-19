import type { SimConfig } from '../config/defaultConfig';
import { approach, clamp } from '../math';

/** ปริมาตรขั้นต่ำที่ใช้คำนวณ EC เพื่อกันหารด้วยศูนย์ (L) */
const MIN_VOLUME_FOR_EC_L = 0.5;

/** EC (mS/cm) = Salt mass / Volume */
export const ecFrom = (saltMass: number, volumeL: number): number => saltMass / Math.max(volumeL, MIN_VOLUME_FOR_EC_L);

export interface SaltFlows {
  volumeBeforeL: number;
  refillInL: number;
  /** สารละลาย A ที่เติม (L) */
  doseAL: number;
  /** สารละลาย B ที่เติม (L) */
  doseBL: number;
  uptakeL: number;
  /** สารละลายที่ออกจากถังโดยตรง (ล้น + รั่ว) (L) */
  drainL: number;
}

/**
 * Salt Mass Balance (FR-08) หน่วย mS/cm·L
 *   dM = EC_stock·(A + B) + EC_tap·Refill − c_up·U·EC − Drain·EC   (Drain = ล้น + รั่ว)
 * น้ำระเหยไม่พาเกลือออก จึงทำให้ EC สูงขึ้น ส่วน Refill เจือจาง
 *
 * หมายเหตุ M1: A และ B เพิ่ม EC เท่ากัน ยังไม่จำลองสัดส่วน A/B หรือธาตุเฉพาะชนิด
 */
export function stepSalt(saltMass: number, f: SaltFlows, cfg: SimConfig): number {
  const n = cfg.nutrient;
  const ec = ecFrom(saltMass, f.volumeBeforeL);
  const added = n.stockEc * (f.doseAL + f.doseBL) + n.tapEc * f.refillInL;
  const removed = n.uptakeSaltRatio * f.uptakeL * ec + f.drainL * ec;
  return Math.max(0, saltMass + added - removed);
}

export interface PhFlows {
  volumeBeforeL: number;
  refillInL: number;
  /** นาทีรวมที่ปั๊ม Nutrient ทำงานใน step นี้ (A + B) */
  doseMinutes: number;
  /** นาทีที่ pH Down Pump (M106) ทำงานใน step นี้ */
  phDownMinutes?: number;
  /** pH ของน้ำที่เติม (เหตุการณ์น้ำประปาด่าง) — ไม่ระบุ = Config */
  tapPh?: number;
}

/**
 * pH แบบ Empirical (FR-09) — เป็นค่าประมาณเพื่อการสอนเท่านั้น
 *   ค่อยเข้าใกล้ดุลยภาพสมมติ, ลดเมื่อเติมสารละลาย, ผสมกับน้ำประปาตามปริมาตร
 * ไม่ใช่เคมีกรด–ด่างหรือการทำนายว่า pH ของจริงจะฟื้นได้เอง (ARCHITECTURE § 11.3)
 * ปั๊ม A/B ไม่ได้ถูกออกแบบให้ใช้ควบคุม pH
 */
export function stepPh(ph: number, f: PhFlows, dtS: number, cfg: SimConfig): number {
  const n = cfg.nutrient;
  let next = approach(ph, n.phEquilibrium, dtS, n.phTauDays * 86_400) - n.phDropPerDoseMin * f.doseMinutes;
  // pH Down (P22): น้ำน้อยกรดเท่าเดิมทำให้ pH ลดแรงกว่า — สเกลด้วยปริมาตรอ้างอิงที่ระดับเริ่มต้น
  if (f.phDownMinutes && f.phDownMinutes > 0) {
    const refL = (cfg.tank.initialLevelPct / 100) * cfg.tank.capacityL;
    const scale = Math.min(4, refL / Math.max(f.volumeBeforeL, 0.5));
    next -= n.phDownPerMin * f.phDownMinutes * scale;
  }
  const total = f.volumeBeforeL + f.refillInL;
  if (f.refillInL > 0 && total > 0) next = (next * f.volumeBeforeL + (f.tapPh ?? n.tapPh) * f.refillInL) / total;
  return clamp(next, n.phMin, n.phMax);
}
