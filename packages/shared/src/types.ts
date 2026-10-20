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
  /** PPFD จากแดดตอนนี้ (µmol/m²/s) — P36; ไม่มีใน D-register */
  sunPpfd?: number;
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
  /** pH Down Pump M106 (P22) */
  phDown: boolean;
}

export type ActuatorKey = keyof ActuatorCommands;

export type GrowthStage = 'seedling' | 'vegetative' | 'harvest';

/** State ของผักแต่ละต้น (FR-20) */
export interface PlantState {
  id: number;
  /** ตำแหน่ง Net Pot (index ใน cfg.light.positionFactors) */
  position: number;
  ageDays: number;
  stage: GrowthStage;
  /** Fresh weight โดยประมาณ (g) */
  biomassG: number;
  leafCount: number;
  leafAreaCm2: number;
  rootLengthCm: number;
  /** 0 = แห้งสนิท, 1 = เต็มที่ */
  hydration: number;
  /** 0–1 */
  waterStress: number;
  /** 0–1 (M2) */
  lightStress: number;
  /** 0–1 (M2) */
  nutrientStress: number;
  /** 0–1, 1 = ปกติ (M2) */
  rootHealth: number;
  /** ความเสียหายถาวร 0–1 */
  damage: number;
  /** 0–100 */
  health: number;
  // --- ค่าวินิจฉัย (ใช้แสดงผลและอธิบาย) ---
  /** สัดส่วนรากที่แช่น้ำ 0–1 */
  rootSubmerged: number;
  /** ความสามารถดูดน้ำเทียบความต้องการ 0–1 */
  supplyRatio: number;
  /** ความต้องการน้ำปัจจุบัน (L/day) */
  demandLPerDay: number;
  ppfd: number;
  dliToday: number;
  dliYesterday: number;
  /** ชั่วโมงแสงสะสมที่ยังไม่ได้พัก (h) — เกินเกณฑ์เกิด Photoperiod stress (P30) */
  lightLoadH: number;
  /** ความเครียดจากอากาศแห้ง (VPD สูง) / ชื้นจัด (VPD ต่ำ) 0–1 — ลด Growth อย่างเดียว (P33) */
  dryAirStress: number;
  humidAirStress: number;
  /** อัตราโตจริงของ Step ล่าสุด (g ต่อชั่วโมงจำลอง) — P35 */
  growthGPerH: number;
  /** ประสิทธิภาพการโตเทียบศักยภาพ = f_light·f_temp·growthFactor·(1 − Damage), 0–lightFactorMax — P35 */
  growthEfficiency: number;
  // --- Plant feedback (P25) ---
  /** Biomass ตอนเที่ยงคืนจำลองล่าสุด (g) */
  biomassDayStartG: number;
  /** Biomass ที่เพิ่มในวันจำลองที่แล้ว (g); null จนกว่าจะผ่านเที่ยงคืนแรกของรอบ */
  gainYesterdayG: number | null;
  /** เวลาจำลองที่เปลี่ยนระยะล่าสุด (s); null ถ้ายังไม่เคยเปลี่ยน */
  stageChangedAtS: number | null;
}
