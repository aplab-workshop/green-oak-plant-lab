import type { SensorKey } from '@gol/shared';

export type SensorStatus = 'ok' | 'warn' | 'alarm' | 'neutral';

export interface SensorMeta {
  digits: number;
  /** ช่วงแนะนำสำหรับ Green Oak (Educational reference) */
  okRange?: [number, number];
  /** ช่วงที่ยังพอรับได้ (นอกนี้ = alarm) */
  warnRange?: [number, number];
  hint: string;
  /** แสดงเป็นค่าประมาณ */
  estimated?: boolean;
}

/**
 * ค่าอ้างอิงเชิงการสอนสำหรับผักสลัดใน DWC — ไม่ใช่เกณฑ์ทางวิทยาศาสตร์ที่ตรวจสอบแล้ว
 */
export const SENSOR_META: Record<SensorKey, SensorMeta> = {
  airTempC: { digits: 1, okRange: [15, 25], warnRange: [10, 29], hint: 'ผักสลัดโตดีที่ 15–25 °C' },
  rhPct: { digits: 1, okRange: [50, 80], warnRange: [40, 90], hint: 'ความชื้นเหมาะสม 50–80 %RH' },
  ppfd: { digits: 0, hint: 'ความเข้มแสงที่ยอดพืช (กลางถัง) — 200–400 ตอนเปิดไฟ' },
  waterTempC: { digits: 1, okRange: [18, 24], warnRange: [15, 27], hint: 'น้ำอุ่นเกินไปทำให้ออกซิเจนในน้ำลดลง' },
  ph: { digits: 2, okRange: [5.5, 6.5], warnRange: [5.0, 7.0], hint: 'ช่วงที่ธาตุอาหารละลายได้ดี 5.5–6.5 (Empirical model)' },
  ecMsCm: { digits: 2, okRange: [0.8, 1.6], warnRange: [0.5, 2.2], hint: 'ความเข้มข้นธาตุอาหารรวม (ไม่บอกชนิดธาตุ)' },
  waterLevelPct: { digits: 0, okRange: [65, 100], warnRange: [55, 100], hint: 'ต้นกล้ารากสั้นเริ่มขาดน้ำเมื่อต่ำกว่า ~55%' },
  flowLpm: { digits: 2, hint: 'อัตราไหลของ Refill Pump' },
  powerW: { digits: 0, hint: 'กำลังไฟรวมของ Actuator' },
  vpdKPa: { digits: 2, okRange: [0.4, 1.2], warnRange: [0.2, 1.6], hint: 'ค่าประมาณจากอากาศ (ไม่มี Leaf temperature)', estimated: true },
  dli: { digits: 2, hint: 'แสงสะสมวันนี้ตั้งแต่ 00:00 เวลาจำลอง — เป้าหมาย ~12–17 mol/m²/day' },
};

export function sensorStatus(key: SensorKey, value: number): SensorStatus {
  const m = SENSOR_META[key];
  if (!m.okRange || !m.warnRange) return 'neutral';
  if (value >= m.okRange[0] && value <= m.okRange[1]) return 'ok';
  if (value >= m.warnRange[0] && value <= m.warnRange[1]) return 'warn';
  return 'alarm';
}
