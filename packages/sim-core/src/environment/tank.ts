import type { SimConfig } from '../config/defaultConfig';
import { clamp } from '../math';

export interface TankFlows {
  /** น้ำที่เติมจาก Refill Pump ใน step นี้ (L) */
  refillInL: number;
  /** น้ำที่เข้าจากปั๊ม Nutrient ใน step นี้ (L) */
  doseInL: number;
  /** น้ำที่พืชขอใช้ใน step นี้ (L) */
  uptakeDemandL: number;
  /** น้ำระเหยใน step นี้ (L) */
  evapL: number;
}

export interface TankResult {
  volumeL: number;
  /** น้ำที่พืชได้จริง (ถูกจำกัดด้วยน้ำที่มีอยู่) */
  uptakeL: number;
  evapL: number;
  /** น้ำที่ล้นถังเมื่อเติมเกิน (L) */
  overflowL: number;
}

/**
 * Water Mass Balance (FR-03)
 *   dV/dt = Q_refill + Q_nutrient − ΣU − E_evap,  V ∈ [0, V_max]
 */
export function stepTank(volumeL: number, f: TankFlows, cfg: SimConfig): TankResult {
  const vMax = cfg.tank.capacityL;
  const available = volumeL + f.refillInL + f.doseInL;
  const losses = f.uptakeDemandL + f.evapL;
  // ถ้าน้ำไม่พอ แบ่งน้ำที่มีตามสัดส่วนความต้องการ
  const scale = losses > available && losses > 0 ? available / losses : 1;
  const uptakeL = f.uptakeDemandL * scale;
  const evapL = f.evapL * scale;
  const raw = available - uptakeL - evapL;
  const overflowL = Math.max(0, raw - vMax);
  return { volumeL: clamp(raw, 0, vMax), uptakeL, evapL, overflowL };
}

/** น้ำระเหยจากผิวน้ำ (L) ใน dt — แปรตาม VPD */
export const evaporationL = (vpd: number, dtS: number, cfg: SimConfig): number =>
  cfg.tank.evapLPerDayAt1kPa * Math.max(0, vpd) * (dtS / 86_400);

export const levelPct = (volumeL: number, cfg: SimConfig): number => (volumeL / cfg.tank.capacityL) * 100;

/** ความสูงผิวน้ำจากพื้นถัง (cm) */
export const waterHeightCm = (volumeL: number, cfg: SimConfig): number =>
  (volumeL / cfg.tank.capacityL) * cfg.tank.heightCm;
