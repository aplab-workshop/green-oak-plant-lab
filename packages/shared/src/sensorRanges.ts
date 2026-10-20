import type { SensorReadings } from './types';

type SensorKey = keyof SensorReadings;

export type SensorStatus = 'ok' | 'warn' | 'alarm' | 'neutral';

export interface SensorRange {
  /** ช่วงแนะนำสำหรับ Green Oak (Educational reference) */
  ok: [number, number];
  /** ช่วงที่ยังพอรับได้ — นอกนี้ = alarm (สีแดง) */
  warn: [number, number];
}

/**
 * ช่วงค่าเชิงการสอนสำหรับผักสลัดใน DWC — ไม่ใช่เกณฑ์ทางวิทยาศาสตร์ที่ตรวจสอบแล้ว
 * ใช้ร่วมกันระหว่าง Dashboard (สีไฟจราจร) และ Server (Auto-pause เมื่อค่าแดงครั้งแรก, SPEC § 4.8)
 */
export const SENSOR_RANGES: Partial<Record<SensorKey, SensorRange>> = {
  airTempC: { ok: [15, 25], warn: [10, 29] },
  rhPct: { ok: [50, 80], warn: [40, 90] },
  waterTempC: { ok: [18, 24], warn: [15, 27] },
  ph: { ok: [5.5, 6.5], warn: [5.0, 7.0] },
  ecMsCm: { ok: [0.8, 1.6], warn: [0.5, 2.2] },
  waterLevelPct: { ok: [65, 100], warn: [55, 100] },
  // P33: ตรงกับเกณฑ์ Air stress (แห้ง > 1.7, ชื้นจัด < 0.5 kPa)
  vpdKPa: { ok: [0.5, 1.7], warn: [0.3, 2.3] },
};

export function sensorStatus(key: SensorKey, value: number): SensorStatus {
  const r = SENSOR_RANGES[key];
  if (!r) return 'neutral';
  if (value >= r.ok[0] && value <= r.ok[1]) return 'ok';
  if (value >= r.warn[0] && value <= r.warn[1]) return 'warn';
  return 'alarm';
}
