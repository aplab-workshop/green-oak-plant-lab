import { COMMAND_BITS, LED_COMMAND_REGISTER, deviceName, type ActuatorKey, type SensorKey } from '@gol/shared';

/** ข้อมูลอุปกรณ์ที่คลิกได้ในฉาก 3D */
export interface ActuatorInfo {
  label: string;
  address: string;
  /** คำอธิบายภาษาไทย */
  description: string;
  ratedPower: string;
}

const DESCRIPTIONS: Record<ActuatorKey, { description: string; ratedPower: string }> = {
  fan: { description: 'ระบายอากาศร้อนจาก LED ออก ลดอุณหภูมิได้ แต่ไม่ต่ำกว่าอุณหภูมิห้อง และลดความชื้น', ratedPower: '15 W' },
  humidifier: { description: 'เพิ่มความชื้นในอากาศ (ใช้น้ำจากถังแยก) ผลจะลดลงเมื่อเปิด Fan พร้อมกัน', ratedPower: '25 W' },
  ledPct: { description: 'ไฟปลูกหรี่ได้ 0–100% กำหนด PPFD และ DLI และสร้างความร้อนในกล่องปลูก', ratedPower: '120 W ที่ 100%' },
  refillPump: { description: 'เติมน้ำจากถังสำรอง 2 L/min ถ้าเปิดค้างขณะถังเต็ม น้ำจะล้นและพาธาตุอาหารออก', ratedPower: '18 W' },
  nutrientA: { description: 'เติมสารละลายธาตุอาหารเข้มข้น A ทำให้ EC สูงขึ้น (ไม่ได้ใช้ควบคุม pH)', ratedPower: '5 W' },
  nutrientB: { description: 'เติมสารละลายธาตุอาหารเข้มข้น B ทำให้ EC สูงขึ้น (ไม่ได้ใช้ควบคุม pH)', ratedPower: '5 W' },
  airPump: { description: 'เติมอากาศให้รากผ่าน Air stone ควรทำงานตลอดเวลา (Fail-safe จะเปิดไว้เสมอ)', ratedPower: '5 W' },
};

export const ACTUATOR_INFO: Record<ActuatorKey, ActuatorInfo> = Object.fromEntries([
  ...COMMAND_BITS.map((b) => [b.key, { label: b.label, address: deviceName('M', b.address), ...DESCRIPTIONS[b.key] }]),
  ['ledPct', { label: LED_COMMAND_REGISTER.label, address: deviceName('D', LED_COMMAND_REGISTER.address), ...DESCRIPTIONS.ledPct }],
]) as Record<ActuatorKey, ActuatorInfo>;

export interface SensorDeviceInfo {
  label: string;
  /** ค่าที่อุปกรณ์นี้วัด (Register แรกคือค่าหลัก) */
  keys: SensorKey[];
  description: string;
}

/** อุปกรณ์ Sensor ในฉาก (key = ค่าหลัก) */
export const SENSOR_DEVICES: Partial<Record<SensorKey, SensorDeviceInfo>> = {
  airTempC: { label: 'Air Temp / RH Sensor', keys: ['airTempC', 'rhPct', 'vpdKPa'], description: 'วัดอุณหภูมิและความชื้นอากาศ VPD คำนวณจากสองค่านี้ (ค่าประมาณ)' },
  ppfd: { label: 'PAR Quantum Sensor', keys: ['ppfd', 'dli'], description: 'วัด PPFD ที่ระดับยอดพืชกลางถัง DLI สะสมจาก PPFD ตามเวลาจำลอง' },
  waterTempC: { label: 'Water Temp Probe', keys: ['waterTempC'], description: 'วัดอุณหภูมิสารละลาย น้ำอุ่นเกินไปทำให้ออกซิเจนในน้ำลดลง' },
  ph: { label: 'pH Probe', keys: ['ph'], description: 'pH model เป็นค่าประมาณเชิงประจักษ์ ระบบนี้ไม่มีปั๊มปรับ pH' },
  ecMsCm: { label: 'EC Probe', keys: ['ecMsCm'], description: 'วัดความเข้มข้นธาตุอาหารรวม ไม่บอกชนิดธาตุ' },
  waterLevelPct: { label: 'Water Level Sensor', keys: ['waterLevelPct'], description: 'ทุ่นลอยวัดระดับน้ำ 0–100% ของความสูงถัง' },
  flowLpm: { label: 'Flow Sensor', keys: ['flowLpm'], description: 'วัดอัตราไหลในท่อ Refill' },
  powerW: { label: 'Power Meter', keys: ['powerW'], description: 'วัดกำลังไฟรวมของ Actuator ทั้งหมด' },
};
