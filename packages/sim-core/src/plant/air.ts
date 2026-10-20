import type { SimConfig } from '../config/defaultConfig';
import { clamp } from '../math';
import { stepStress } from './stress';

/**
 * Air (VPD) stress (P33 / SPEC § 4.16) — ลด Growth อย่างเดียว ไม่สร้าง Damage (เพดาน < damageStressThreshold)
 *   แห้ง: VPD สูงต่อเนื่อง (คายน้ำสูง/ปิดปากใบ) → รวมกลุ่มน้ำ
 *   ชื้นจัด: VPD ต่ำต่อเนื่อง (ลำเลียงธาตุอาหารด้วยการคายน้ำได้น้อย) → รวมกลุ่มธาตุอาหาร
 */
export function dryAirStressTarget(vpdKPa: number, cfg: SimConfig): number {
  const a = cfg.airStress;
  return clamp((vpdKPa - a.dryStartKPa) / (a.dryFullKPa - a.dryStartKPa), 0, 1) * a.maxStress;
}

export function humidAirStressTarget(vpdKPa: number, cfg: SimConfig): number {
  const a = cfg.airStress;
  return clamp((a.humidStartKPa - vpdKPa) / (a.humidStartKPa - a.humidFullKPa), 0, 1) * a.maxStress;
}

export function stepAirStress(dry: number, humid: number, vpdKPa: number, dtS: number, cfg: SimConfig): { dry: number; humid: number } {
  const a = cfg.airStress;
  return {
    dry: stepStress(dry, dryAirStressTarget(vpdKPa, cfg), dtS, a.riseH, a.recoveryH),
    humid: stepStress(humid, humidAirStressTarget(vpdKPa, cfg), dtS, a.riseH, a.recoveryH),
  };
}
