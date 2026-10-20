import type { SimConfig } from '../config/defaultConfig';
import { approach, clamp } from '../math';
import { hourOfDay } from '../clock';

/** อุณหภูมิห้องเรียน (°C) แกว่งรายวันแบบ sine สูงสุดที่ tempPeakHour */
export function roomTempC(simTimeS: number, cfg: SimConfig): number {
  const h = hourOfDay(simTimeS);
  const { tempMeanC, tempAmplitudeC, tempPeakHour } = cfg.room;
  return tempMeanC + tempAmplitudeC * Math.cos((2 * Math.PI * (h - tempPeakHour)) / 24);
}

export interface AirInput {
  simTimeS: number;
  ledPct: number;
  fan: boolean;
  humidifier: boolean;
  /** เหตุการณ์ (SPEC § 4.8): อุณหภูมิห้องเพิ่ม (°C) */
  roomTempDeltaC?: number;
  /** เหตุการณ์: RH ห้องเปลี่ยน (%) */
  roomRhDeltaPct?: number;
  /** สัดส่วนแดดเทียบสูงสุด 0–1 (P36) */
  sunFrac?: number;
}

export interface AirState {
  airTempC: number;
  rhPct: number;
}

/**
 * อุณหภูมิและความชื้นอากาศแบบ First-order (FR-06)
 *   T_eq  = T_room + (ΔT_LED·LED + ΔT_sun·sun)·(1 − η_fan·fan)   (P36: ความร้อนจากแดด)
 *   RH_eq = RH_room + G_hum·hum·(1 − L_fan·fan) + M_enc·(1 − fan) − k·(T − T_room)
 * Fan ทำให้อุณหภูมิต่ำกว่าห้องไม่ได้
 */
export function stepAir(s: AirState, u: AirInput, dtS: number, cfg: SimConfig): AirState {
  const a = cfg.air;
  const tRoom = roomTempC(u.simTimeS, cfg) + (u.roomTempDeltaC ?? 0);
  const fan = u.fan ? 1 : 0;
  const hum = u.humidifier ? 1 : 0;
  const led = clamp(u.ledPct, 0, 100) / 100;

  const tEq = tRoom + (a.ledHeatC * led + cfg.sun.heatC * clamp(u.sunFrac ?? 0, 0, 1)) * (1 - a.fanEfficiency * fan);
  const airTempC = approach(s.airTempC, tEq, dtS, a.tempTauMin * 60);

  const rhEq = clamp(
    cfg.room.rhPct + (u.roomRhDeltaPct ?? 0) +
      a.humidifierGainPct * hum * (1 - a.fanHumidityLoss * fan) +
      a.enclosureMoisturePct * (1 - fan) -
      a.rhPerDegC * (airTempC - tRoom),
    a.rhMinPct,
    a.rhMaxPct,
  );
  const rhPct = clamp(approach(s.rhPct, rhEq, dtS, a.rhTauMin * 60), a.rhMinPct, a.rhMaxPct);

  return { airTempC, rhPct };
}

/**
 * อุณหภูมิน้ำ: เข้าหาอุณหภูมิอากาศช้า ๆ แล้วผสมกับน้ำประปาที่เติมตามสัดส่วนปริมาตร
 */
export function stepWaterTemp(
  waterTempC: number,
  airTempC: number,
  volumeBeforeL: number,
  refillInL: number,
  dtS: number,
  cfg: SimConfig,
): number {
  const t = approach(waterTempC, airTempC, dtS, cfg.air.waterTempTauH * 3600);
  const total = volumeBeforeL + refillInL;
  if (refillInL <= 0 || total <= 0) return t;
  return (t * volumeBeforeL + cfg.tank.supplyTempC * refillInL) / total;
}
