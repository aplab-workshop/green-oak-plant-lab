/**
 * พารามิเตอร์ของ Simulation (ARCHITECTURE.md § 7)
 *
 * ค่าทั้งหมดเป็นค่าเชิงการสอน (Educational) ตั้งให้สมเหตุสมผลและเห็นผลในเวลาเรียนที่ 360x
 * ยังไม่ได้ปรับเทียบกับข้อมูลจริง — แก้ค่าที่นี่ที่เดียวเมื่อมีข้อมูลปรับเทียบ
 */
export interface SimConfig {
  time: {
    /** Fixed time-step (s, เวลาจำลอง) */
    dtS: number;
    /** เวลาเริ่ม: วันหลังเพาะ */
    startDay: number;
    /** เวลาเริ่ม: ชั่วโมงของวัน */
    startHour: number;
    /** จำนวน step สูงสุดต่อ 1 tick ของ Server (กัน spiral of death) */
    maxStepsPerTick: number;
  };
  tank: {
    /** ปริมาตรที่ 100% (L) */
    capacityL: number;
    /** ความสูงน้ำที่ 100% (cm) */
    heightCm: number;
    /** ความสูงก้น Net Pot จากพื้นถัง (cm) */
    potBottomCm: number;
    /** ระดับน้ำเริ่มต้น (%) */
    initialLevelPct: number;
    /** อัตราไหลของ Refill Pump (L/min) */
    refillFlowLpm: number;
    /** การระเหยผิวน้ำที่ VPD 1 kPa (L/day) — ถังมีฝา */
    evapLPerDayAt1kPa: number;
    /** อุณหภูมิน้ำประปาที่เติม (°C) */
    supplyTempC: number;
  };
  room: {
    /** อุณหภูมิห้องเฉลี่ย (°C) */
    tempMeanC: number;
    /** แอมพลิจูดการแกว่งรายวัน (°C) */
    tempAmplitudeC: number;
    /** ชั่วโมงที่ห้องร้อนที่สุด */
    tempPeakHour: number;
    /** ความชื้นห้อง (%RH) */
    rhPct: number;
  };
  air: {
    /** ความร้อนจาก LED ที่ 100% (°C เหนืออุณหภูมิห้อง) */
    ledHeatC: number;
    /** ประสิทธิภาพการระบายความร้อนของ Fan (0–1) */
    fanEfficiency: number;
    /** Time constant อุณหภูมิอากาศ (min) */
    tempTauMin: number;
    /** RH ที่ Humidifier เพิ่มได้ (%) */
    humidifierGainPct: number;
    /** Fan ลดผลของ Humidifier (สัดส่วน 0–1) */
    fanHumidityLoss: number;
    /** ความชื้นสะสมในกล่องเมื่อไม่เปิด Fan (%) */
    enclosureMoisturePct: number;
    /** RH ลดลงต่อ 1 °C ที่อากาศร้อนกว่าห้อง (%/°C) */
    rhPerDegC: number;
    /** Time constant ความชื้น (min) */
    rhTauMin: number;
    rhMinPct: number;
    rhMaxPct: number;
    /** Time constant อุณหภูมิน้ำ (h) */
    waterTempTauH: number;
  };
  light: {
    /** PPFD ที่ยอดพืชเมื่อ LED 100% ตำแหน่งกลาง (µmol/m²/s) */
    ppfdMax: number;
    /** สัดส่วนแสงตามตำแหน่งต้น (index = ตำแหน่ง Net Pot) */
    positionFactors: number[];
  };
  nutrient: {
    /** EC เริ่มต้น (mS/cm) */
    initialEc: number;
    /** EC น้ำประปา (mS/cm) */
    tapEc: number;
    /** อัตราไหลปั๊ม Nutrient แต่ละตัว (L/min) */
    doseFlowLpm: number;
    /** EC ของสารละลายเข้มข้น A หรือ B (mS/cm) */
    stockEc: number;
    /** สัดส่วนการดูดเกลือเทียบกับน้ำ (< 1 → EC ค่อย ๆ สูงขึ้น) */
    uptakeSaltRatio: number;
    /** pH เริ่มต้น */
    initialPh: number;
    /** pH น้ำประปา */
    tapPh: number;
    /** pH drift ขึ้นจากการดูดธาตุ (pH/day) — Empirical */
    phDriftPerDay: number;
    /** pH ลดลงต่อการเปิดปั๊ม Nutrient 1 ตัว 1 นาที — Empirical */
    phDropPerDoseMin: number;
    phMin: number;
    phMax: number;
  };
  power: {
    ledW: number;
    fanW: number;
    humidifierW: number;
    refillPumpW: number;
    nutrientPumpW: number;
    airPumpW: number;
  };
  /** Sensor noise (Standard deviation) — 0 = ปิด */
  noise: {
    airTempC: number;
    rhPct: number;
    ppfd: number;
    waterTempC: number;
    ph: number;
    ecMsCm: number;
    waterLevelPct: number;
  };
}

export const DEFAULT_CONFIG: SimConfig = {
  time: { dtS: 1, startDay: 14, startHour: 6, maxStepsPerTick: 5000 },
  tank: {
    capacityL: 40,
    heightCm: 20,
    potBottomCm: 15,
    initialLevelPct: 85,
    refillFlowLpm: 2.0,
    evapLPerDayAt1kPa: 0.05,
    supplyTempC: 27,
  },
  room: { tempMeanC: 26, tempAmplitudeC: 2, tempPeakHour: 15, rhPct: 60 },
  air: {
    ledHeatC: 6,
    fanEfficiency: 0.7,
    tempTauMin: 20,
    humidifierGainPct: 25,
    fanHumidityLoss: 0.6,
    enclosureMoisturePct: 5,
    rhPerDegC: 2.5,
    rhTauMin: 15,
    rhMinPct: 20,
    rhMaxPct: 98,
    waterTempTauH: 6,
  },
  light: {
    ppfdMax: 400,
    // Net Pot 2 แถว × 3 คอลัมน์: คอลัมน์กลางได้แสงเต็ม มุมได้ 85%
    positionFactors: [0.85, 1.0, 0.85, 0.85, 1.0, 0.85],
  },
  nutrient: {
    initialEc: 1.2,
    tapEc: 0.2,
    doseFlowLpm: 0.05,
    stockEc: 100,
    uptakeSaltRatio: 0.8,
    initialPh: 6.0,
    tapPh: 7.2,
    phDriftPerDay: 0.1,
    phDropPerDoseMin: 0.02,
    phMin: 4,
    phMax: 9,
  },
  power: { ledW: 120, fanW: 15, humidifierW: 25, refillPumpW: 18, nutrientPumpW: 5, airPumpW: 5 },
  noise: { airTempC: 0.1, rhPct: 0.5, ppfd: 2, waterTempC: 0.05, ph: 0.01, ecMsCm: 0.01, waterLevelPct: 0.2 },
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] };

/** สร้าง Config จากค่า Default + ค่าที่ต้องการเปลี่ยน */
export function makeConfig(overrides: DeepPartial<SimConfig> = {}): SimConfig {
  // Config เป็น plain data ล้วน จึง clone ด้วย JSON ได้ (sim-core ไม่พึ่ง DOM/Node API)
  const out = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as Record<string, Record<string, unknown>>;
  for (const [section, values] of Object.entries(overrides)) {
    if (values) Object.assign(out[section] as object, values);
  }
  return out as unknown as SimConfig;
}
