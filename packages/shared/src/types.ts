/** ค่า Sensor ในหน่วยทางวิศวกรรม (ก่อน Scaling) */
export interface SensorReadings {
  airTempC: number;
  rhPct: number;
  ppfd: number;
  waterTempC: number;
  ph: number;
  ecMsCm: number;
  waterLevelPct: number;
  flowLpm: number;
  powerW: number;
  vpdKPa: number;
  dli: number;
}

/** ข้อมูลเวลาจำลองที่ส่งให้ PLC (D111, D112) */
export interface SimInfo {
  /** นาทีของวัน 0–1439 */
  minuteOfDay: number;
  /** วันนับจากเพาะ */
  day: number;
}

/** คำสั่ง Actuator ที่อ่านจาก PLC */
export interface ActuatorCommands {
  fan: boolean;
  humidifier: boolean;
  /** Grow light brightness 0–100 % */
  ledPct: number;
  refillPump: boolean;
  nutrientA: boolean;
  nutrientB: boolean;
  airPump: boolean;
}

export type ActuatorKey = keyof ActuatorCommands;
