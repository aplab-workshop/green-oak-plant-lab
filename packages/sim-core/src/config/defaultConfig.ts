/**
 * พารามิเตอร์ของ Simulation (ARCHITECTURE.md § 7)
 *
 * ค่าทั้งหมดเป็นค่าเชิงการสอน (Educational) ตั้งให้สมเหตุสมผลและเห็นผลในเวลาเรียนที่ 360x
 * ยังไม่ได้ปรับเทียบกับข้อมูลจริง — แก้ค่าที่นี่ที่เดียวเมื่อมีข้อมูลปรับเทียบ
 */
export interface SimConfig {
  game: {
    /** น้ำหนักสุขภาพเฉลี่ยตลอดรอบ [0,1]; ส่วนที่เหลือเป็น Growth */
    healthWeight: number;
    /** คะแนนเต็ม (points) */
    maxScore: number;
    /** ระยะรอบขั้นต่ำเพื่อบันทึก Best (s จำลอง) */
    recordMinS: number;
    /** โบนัสเก็บเกี่ยวสูงสุด (points) × aliveFraction × สุขภาพเฉลี่ย/100 (P20) */
    harvestBonus: number;
    /** สุขภาพเฉลี่ยขั้นต่ำสำหรับดาวที่ 3 (%) (P21) */
    starHealthPct: number;
    /** คะแนนที่หักต่อน้ำล้น 1 L ขณะเล่น (points/L) (P29) */
    overflowPenaltyPerL: number;
    /** คะแนนที่หักจากน้ำล้นสูงสุดต่อรอบ (points) (P29) */
    overflowPenaltyMax: number;
  };
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
  /** แสงแดดผ่านหลังคาโรงเรือน (P36) — PPFD ที่ต้น = แดด + LED */
  sun: {
    /** PPFD สูงสุดจากแดดที่ระดับยอดพืช (µmol/m²/s); 0 = ไม่มีแดด */
    peakPpfd: number;
    /** ชั่วโมงพระอาทิตย์ขึ้น / แสงสูงสุด / ตก (เวลาจำลอง 0–24) */
    riseHour: number;
    peakHour: number;
    setHour: number;
    /** ความร้อนจากแดดที่เพิ่มให้อากาศตอนแดดสูงสุด (°C) — พัดลมลดได้เหมือนความร้อน LED */
    heatC: number;
  };
  light: {
    /** PPFD ที่ยอดพืชเมื่อ LED 100% ตำแหน่งกลาง (µmol/m²/s) */
    ppfdMax: number;
    /** สัดส่วนแสงตามตำแหน่งต้น (index = ตำแหน่ง Net Pot) */
    positionFactors: number[];
    /** PPFD เริ่มสะสม / เต็มระดับ (µmol/m²/s), 0 ≤ start < full */
    stressStartPpfd: number;
    stressFullPpfd: number;
    /** อุณหภูมิเริ่มขยาย Stress / ช่วงเพิ่มจนเต็ม (°C), span > 0 */
    stressHeatStartC: number;
    stressHeatSpanC: number;
    /** ตัวขยายจากความร้อน / ขาดน้ำ (ไร้หน่วย ≥ 0) */
    stressHeatGain: number;
    stressWaterGain: number;
    /** Time constant สะสม / ฟื้น Light Stress (h, > 0) */
    stressRiseH: number;
    stressRecoveryH: number;
    // --- Photoperiod stress (P30): ผักต้องการช่วงมืดพัก ---
    /** PPFD ต่ำกว่านี้ = ได้พัก (µmol/m²/s) */
    restPpfd: number;
    /** PPFD ที่สะสมชั่วโมงแสงเต็มอัตรา 1 h/h (µmol/m²/s) */
    loadRefPpfd: number;
    /** อัตราล้างชั่วโมงแสงสะสมตอนมืดสนิท (h ต่อ h) */
    restRecoveryPerH: number;
    /** ชั่วโมงแสงสะสมที่เริ่มเกิด Stress / ช่วงจนถึงเพดาน (h) */
    photoperiodMaxH: number;
    photoperiodSpanH: number;
    /** เพดาน Photoperiod stress [0,1] — ต่ำกว่า damageStressThreshold เพื่อให้โตช้าแต่ไม่ตาย */
    photoperiodMaxStress: number;
    /** เพดานชั่วโมงแสงสะสม (h) */
    lightLoadMaxH: number;
  };
  /** Air (VPD) stress (P33) — ค่าเชิงการสอน ตั้งให้สูตรดูแล (VPD 0.93–1.6 kPa) ไม่เกิด Stress */
  airStress: {
    /** VPD ที่เริ่มเกิด Dry stress / ถึงเพดาน (kPa) */
    dryStartKPa: number;
    dryFullKPa: number;
    /** VPD ที่เริ่มเกิด Humid stress / ถึงเพดาน (kPa), full < start */
    humidStartKPa: number;
    humidFullKPa: number;
    /** เพดาน Stress [0,1] — ต่ำกว่า damageStressThreshold เพื่อไม่ให้เกิด Damage */
    maxStress: number;
    /** Time constant สะสม / ฟื้น (h) */
    riseH: number;
    recoveryH: number;
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
    /** ดุลยภาพสมมติของ pH [phMin, phMax] — Empirical ไม่ใช่ปั๊มปรับ pH */
    phEquilibrium: number;
    /** Time constant เข้าสู่ดุลยภาพ pH (day, > 0) */
    phTauDays: number;
    /** pH ลดลงต่อการเปิดปั๊ม Nutrient 1 ตัว 1 นาที — Empirical */
    phDropPerDoseMin: number;
    /** pH ลดลงต่อนาทีที่ pH Down Pump (M106) เปิด ณ ปริมาตรที่ระดับเริ่มต้น — Empirical (P22) */
    phDownPerMin: number;
    phMin: number;
    phMax: number;
    /** Suitability [min, optLow, optHigh, max] เรียงเพิ่ม (mS/cm) */
    ecCardinalMsCm: [number, number, number, number];
    /** Suitability [min, optLow, optHigh, max] เรียงเพิ่ม (pH) */
    phCardinal: [number, number, number, number];
    /** Time constant สะสม / ฟื้น Nutrient Stress (h, > 0) */
    stressRiseH: number;
    stressRecoveryH: number;
  };
  /** Root/Oxygen model เชิงการสอน (ARCHITECTURE § 11.4), ไม่มี DO Sensor */
  root: {
    /** Oxygen เริ่มต้น / ดุลยภาพเมื่อ Pump ON / OFF (ดัชนีไร้หน่วย [0,1]) */
    initialOxygen: number;
    oxygenOnTarget: number;
    oxygenOffTarget: number;
    /** อุณหภูมิอ้างอิง / ช่วงที่ Oxygen capacity ลดจนศูนย์ (°C), span > 0 */
    oxygenTempRefC: number;
    oxygenTempSpanC: number;
    /** ระดับน้ำขั้นต่ำที่ Air Pump ให้ผลเต็มตาม Model (%, > 0 ถึง 100) */
    oxygenMinLevelPct: number;
    /** Time constant Oxygen เพิ่ม / ลด (h, > 0) */
    oxygenRiseH: number;
    oxygenFallH: number;
    /** Oxygen ที่ไม่จำกัด Root Health (ดัชนีไร้หน่วย (0,1]) */
    healthyOxygen: number;
    /** Time constant Root Health เสื่อม / ฟื้น (h, > 0) */
    healthDeclineH: number;
    healthRecoveryH: number;
  };
  events: {
    /** Threshold เริ่ม / คลาย Stress Event (ไร้หน่วย, 0 ≤ off < on ≤ 1) */
    stressOn: number;
    stressOff: number;
    /** ระดับ Damage ถาวรที่แจ้ง Event (0–1 เรียงเพิ่ม) */
    damageLevels: number[];
  };
  power: {
    ledW: number;
    fanW: number;
    humidifierW: number;
    refillPumpW: number;
    nutrientPumpW: number;
    airPumpW: number;
    /** pH Down Pump M106 (W) */
    phDownPumpW: number;
  };
  /** เหตุการณ์ท้าทาย (SPEC § 4.8) */
  challenges: {
    /** เตือนล่วงหน้าก่อนเริ่ม (s จำลอง) */
    warnAheadS: number;
    /** ระยะห่างขั้นต่ำระหว่างเหตุการณ์ (วัน) */
    minGapDays: number;
    /** คลื่นความร้อน: อุณหภูมิห้องเพิ่ม (°C) และระยะเวลา [ต่ำสุด, สูงสุด] (h) */
    heatWaveDeltaC: number;
    heatWaveHours: [number, number];
    /** ถังรั่ว (L/h) จนกว่าจะซ่อม */
    leakLph: number;
    /** Mascot วิ่งเข้ามาก่อนเตะถัง / วิ่งออกหลังเตะ (s จำลอง) — ถังรั่วแบบ surprise (P41) */
    mascotEnterS: number;
    mascotExitS: number;
    /** ไฟดับ [ต่ำสุด, สูงสุด] (h) */
    outageHours: [number, number];
    /** อากาศแห้ง: RH ห้องเปลี่ยน (%, ติดลบ) และระยะเวลา (h) */
    dryAirRhDeltaPct: number;
    dryAirHours: number;
    /** น้ำประปาด่าง: pH ของน้ำที่เติม และระยะเวลา (h) */
    alkalineTapPh: number;
    alkalineTapHours: number;
  };
  /** ระยะเวลาต่อ 1 โดส (s เวลาจำลอง) — SPEC § 4.7 */
  dose: {
    /** M102: 2 L/min × 2 นาที = 4 L ≈ +10% ของถัง 40 L */
    refillS: number;
    /** M103+M104: 2 × 0.05 L/min × 0.5 นาที × EC 100 = 5 mS/cm·L ≈ EC +0.15 ที่ 34 L */
    nutrientS: number;
    /** M106: 0.1 pH/นาที × 2 นาที ≈ pH −0.2 ที่ระดับน้ำ 85% */
    phDownS: number;
    /** จำนวนโดสค้างสูงสุดต่ออุปกรณ์ */
    maxQueued: number;
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
  /** Plant model (ARCHITECTURE.md § 7.4–7.5) */
  plant: {
    /** จำนวนต้นเริ่มต้น */
    count: number;
    /** Biomass (fresh weight) เริ่มต้นเฉลี่ย (g) */
    initialBiomassG: number;
    /** ความแปรปรวนของ Biomass เริ่มต้นระหว่างต้น (± สัดส่วน) */
    initialBiomassSpread: number;
    /** Biomass สูงสุด (g) */
    maxBiomassG: number;
    /** อัตราการเติบโตสูงสุด (1/day) */
    growthRatePerDay: number;
    /** PPFD ที่ให้ f_light = 0.5 ของค่าสูงสุดตามสมการ Michaelis–Menten (µmol/m²/s) */
    lightHalfSatPpfd: number;
    /** PPFD อ้างอิงที่ f_light = 1 */
    lightRefPpfd: number;
    lightFactorMax: number;
    /** Trapezoid อุณหภูมิสำหรับการเติบโต [min, optLow, optHigh, max] (°C) */
    tempCardinalC: [number, number, number, number];
    /** พื้นที่ใบต่อ Biomass (cm²/g) */
    leafAreaPerG: number;
    /** รากเริ่มต้น / เพิ่มได้สูงสุด (cm) และ Biomass ที่รากโตได้ 63% (g) */
    rootBaseCm: number;
    rootGainCm: number;
    rootBiomassScaleG: number;
    /** Transpiration ต่อพื้นที่ใบที่ VPD 1 kPa และ PPFD อ้างอิง (L/m²/day) */
    transpirationLPerM2Day: number;
    /** PPFD อ้างอิงของ Transpiration */
    transpirationRefPpfd: number;
    /** สัดส่วน Transpiration ตอนมืด (Stomata ปิดบางส่วน) */
    transpirationDarkFraction: number;
    /** VPD อ้างอิง (kPa) ที่ใช้คิดความต้องการน้ำเมื่อด่านไม่นับอุณหภูมิ/อากาศ (P38) */
    referenceVpdKPa: number;
    /** สัดส่วนรากที่ต้องแช่น้ำเพื่อดูดน้ำได้เต็มที่ */
    rootCriticalFraction: number;
    /** อัตราสูญเสีย Hydration เมื่อขาดน้ำสนิทที่สภาวะอ้างอิง (1/h) */
    hydrationLossPerH: number;
    /** อัตราฟื้น Hydration (1/h) */
    hydrationRecoveryPerH: number;
    /** Hydration ที่ถือว่าเหี่ยวเต็มที่ (Water stress = 1) */
    wiltHydration: number;
    /** max(Water/Root/Light/Nutrient Stress) ที่เริ่มเกิด Damage ถาวร (0–1) */
    damageStressThreshold: number;
    /** อัตราเกิด Damage ต่อ Stress ส่วนเกิน (1/h) */
    damagePerH: number;
    /** Damage ลด Hydration สูงสุดที่ฟื้นได้: H_cap = 1 − k·Damage */
    damageHydrationCapFactor: number;
    /** Biomass ที่เปลี่ยน Growth stage (g) */
    vegetativeAtG: number;
    harvestAtG: number;
  };
}

export const DEFAULT_CONFIG: SimConfig = {
  game: { healthWeight: 0.8, maxScore: 1000, recordMinS: 86_400, harvestBonus: 500, starHealthPct: 85, overflowPenaltyPerL: 10, overflowPenaltyMax: 300 },
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
  // ห้องเรียนมีเครื่องปรับอากาศ
  room: { tempMeanC: 24, tempAmplitudeC: 2, tempPeakHour: 15, rhPct: 60 },
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
  sun: { peakPpfd: 300, riseHour: 6, peakHour: 13, setHour: 19, heatC: 2 },
  light: {
    ppfdMax: 400,
    // Net Pot 2 แถว × 3 คอลัมน์: คอลัมน์กลางได้แสงเต็ม มุมได้ 85%
    positionFactors: [0.85, 1.0, 0.85, 0.85, 1.0, 0.85],
    stressStartPpfd: 350,
    stressFullPpfd: 650,
    stressHeatStartC: 28,
    stressHeatSpanC: 8,
    stressHeatGain: 1,
    stressWaterGain: 1,
    stressRiseH: 2,
    stressRecoveryH: 4,
    restPpfd: 60,
    loadRefPpfd: 250,
    restRecoveryPerH: 3,
    photoperiodMaxH: 18,
    photoperiodSpanH: 8,
    photoperiodMaxStress: 0.6,
    lightLoadMaxH: 48,
  },
  airStress: { dryStartKPa: 1.7, dryFullKPa: 2.5, humidStartKPa: 0.5, humidFullKPa: 0.2, maxStress: 0.5, riseH: 6, recoveryH: 6 },
  nutrient: {
    initialEc: 1.2,
    tapEc: 0.2,
    doseFlowLpm: 0.05,
    stockEc: 100,
    uptakeSaltRatio: 0.8,
    initialPh: 6.0,
    tapPh: 7.2,
    phEquilibrium: 6.2,
    phTauDays: 2,
    phDropPerDoseMin: 0.02,
    phDownPerMin: 0.1,
    phMin: 4,
    phMax: 9,
    ecCardinalMsCm: [0, 0.8, 1.6, 3.2],
    phCardinal: [4, 5.5, 6.8, 9],
    stressRiseH: 6,
    stressRecoveryH: 12,
  },
  root: {
    initialOxygen: 0.95,
    oxygenOnTarget: 0.95,
    oxygenOffTarget: 0.2,
    oxygenTempRefC: 24,
    oxygenTempSpanC: 16,
    oxygenMinLevelPct: 10,
    oxygenRiseH: 2,
    oxygenFallH: 2,
    healthyOxygen: 0.6,
    healthDeclineH: 12,
    healthRecoveryH: 6,
  },
  events: { stressOn: 0.3, stressOff: 0.15, damageLevels: [0.01, 0.25, 0.5] },
  power: { ledW: 120, fanW: 15, humidifierW: 25, refillPumpW: 18, nutrientPumpW: 5, airPumpW: 5, phDownPumpW: 5 },
  dose: { refillS: 120, nutrientS: 30, phDownS: 120, maxQueued: 5 },
  challenges: {
    warnAheadS: 6 * 3600,
    minGapDays: 2,
    heatWaveDeltaC: 5,
    heatWaveHours: [6, 8],
    leakLph: 1.5,
    mascotEnterS: 600,
    mascotExitS: 600,
    outageHours: [2, 3],
    dryAirRhDeltaPct: -20,
    dryAirHours: 12,
    alkalineTapPh: 8.0,
    alkalineTapHours: 24,
  },
  noise: { airTempC: 0.1, rhPct: 0.5, ppfd: 2, waterTempC: 0.05, ph: 0.01, ecMsCm: 0.01, waterLevelPct: 0.2 },
  plant: {
    count: 6,
    initialBiomassG: 5,
    initialBiomassSpread: 0.15,
    maxBiomassG: 150,
    growthRatePerDay: 0.25,
    lightHalfSatPpfd: 150,
    lightRefPpfd: 250,
    lightFactorMax: 1.2,
    tempCardinalC: [4, 15, 25, 33],
    leafAreaPerG: 10,
    rootBaseCm: 4,
    rootGainCm: 14,
    rootBiomassScaleG: 40,
    transpirationLPerM2Day: 3.3,
    transpirationRefPpfd: 250,
    transpirationDarkFraction: 0.3,
    referenceVpdKPa: 1.0,
    rootCriticalFraction: 0.3,
    hydrationLossPerH: 0.12,
    hydrationRecoveryPerH: 0.5,
    wiltHydration: 0.4,
    damageStressThreshold: 0.7,
    damagePerH: 0.14,
    damageHydrationCapFactor: 0.5,
    vegetativeAtG: 15,
    harvestAtG: 100,
  },
};

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] };

/** สร้าง Config จากค่า Default + ค่าที่ต้องการเปลี่ยน */
export function makeConfig(overrides: DeepPartial<SimConfig> = {}): SimConfig {
  return mergeConfig(DEFAULT_CONFIG, overrides);
}

/** Config ใหม่จาก base + ค่าที่เปลี่ยน (ระดับ section) — ใช้ทับ Config เฉพาะรอบของด่าน (P42) */
export function mergeConfig(base: SimConfig, overrides: DeepPartial<SimConfig>): SimConfig {
  // Config เป็น plain data ล้วน จึง clone ด้วย JSON ได้ (sim-core ไม่พึ่ง DOM/Node API)
  const out = JSON.parse(JSON.stringify(base)) as Record<string, Record<string, unknown>>;
  for (const [section, values] of Object.entries(overrides)) {
    if (values) Object.assign(out[section] as object, values);
  }
  return out as unknown as SimConfig;
}
