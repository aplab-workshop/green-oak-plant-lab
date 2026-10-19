import { SENSOR_RANGES, sensorStatus, type SensorKey, type SensorStatus } from '@gol/shared';

export { sensorStatus, type SensorStatus };

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

const range = (k: SensorKey) => {
  const r = SENSOR_RANGES[k];
  return r ? { okRange: r.ok, warnRange: r.warn } : {};
};

/**
 * ค่าอ้างอิงเชิงการสอนสำหรับผักสลัดใน DWC — ช่วงค่าอยู่ใน @gol/shared (SENSOR_RANGES) ใช้ร่วมกับ Server
 */
export const SENSOR_META: Record<SensorKey, SensorMeta> = {
  airTempC: { digits: 1, ...range('airTempC'), hint: 'ผักสลัดโตดีที่ 15–25 °C' },
  rhPct: { digits: 1, ...range('rhPct'), hint: 'ความชื้นเหมาะสม 50–80 %RH' },
  ppfd: { digits: 0, hint: 'ความเข้มแสงที่ยอดพืช (กลางถัง) — 200–400 ตอนเปิดไฟ' },
  waterTempC: { digits: 1, ...range('waterTempC'), hint: 'น้ำอุ่นเกินไปทำให้ออกซิเจนในน้ำลดลง' },
  ph: { digits: 2, ...range('ph'), hint: 'ช่วงที่ธาตุอาหารละลายได้ดี 5.5–6.5 (Empirical model)' },
  ecMsCm: { digits: 2, ...range('ecMsCm'), hint: 'ความเข้มข้นธาตุอาหารรวม (ไม่บอกชนิดธาตุ)' },
  waterLevelPct: { digits: 0, ...range('waterLevelPct'), hint: 'ต้นกล้ารากสั้นเริ่มขาดน้ำเมื่อต่ำกว่า ~55%' },
  flowLpm: { digits: 2, hint: 'อัตราไหลของ Refill Pump' },
  powerW: { digits: 0, hint: 'กำลังไฟรวมของ Actuator' },
  vpdKPa: { digits: 2, ...range('vpdKPa'), hint: 'ค่าประมาณจากอากาศ (ไม่มี Leaf temperature)', estimated: true },
  dli: { digits: 2, hint: 'แสงสะสมวันนี้ตั้งแต่ 00:00 เวลาจำลอง — เป้าหมาย ~12–17 mol/m²/day' },
};
