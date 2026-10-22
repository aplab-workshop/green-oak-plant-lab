import type { LevelId, LevelInfo } from '@gol/shared';
import type { RoundStart } from './simulation';
import type { DeepPartial, SimConfig } from './config/defaultConfig';
import { CHALLENGE_KINDS, type ChallengeSpec } from './challenges';

/** ด่านของเกม (SPEC § 4.6) — เป้าหมายตั้งจาก Simulation ตามสูตรใน GAME-GUIDE */
export interface LevelDef extends LevelInfo {
  /** อายุต้นตอนเริ่ม (วันจำลองนับจากเพาะ) */
  startDay: number;
  /** เหตุการณ์ท้าทายของด่าน (SPEC § 4.8) — ไม่มี = ไม่มีเหตุการณ์ */
  challenges?: ChallengeSpec;
  /** ระดับน้ำเริ่มรอบ (%) — ไม่มี = ค่าปกติใน Config (P37) */
  startWaterPct?: number;
  /** ค่า Config ที่ด่านทับ (P42) — เช่น ด่าน 1 ปรับปั๊มเติมน้ำ/Mascot ให้เหมาะกับ 720x */
  cfg?: DeepPartial<SimConfig>;
}

export const LEVELS: readonly LevelDef[] = [
  // P37 (SPEC § 4.20): คุม Refill + LED, อุปกรณ์อื่นปิดสนิท, เริ่มถังว่าง, รั่วเป็นช่วง ๆ หยุดเอง
  { id: 'L1', title: 'ต้นกล้าแรก', description: 'เติมน้ำจากถังว่างและคุมแสงตามช่วงเวลา (แดด + LED) ระวัง Mascot แอบมาทำถังรั่ว และน้ำล้น',
    // P43 (ผู้ใช้: 5 วัน) วัด Seed 1–5 พร้อมรั่วแบบใหม่: สูตรดูแล ต้นเล็กสุด ≥ 8.89 g ที่ 4.25 วัน (ใช้ไฟ 4.2 kWh),
    // แดดอย่างเดียว ≤ 7.97 g ที่ 5 วัน → เป้า 8.8 g: ต้องคุมไฟจริง และสูตรดูแลเหลือเวลา ≥ 15 %
    startBiomassG: 5, startDay: 14, targetG: 8.8, timeLimitDays: 5, energyBudgetKWh: 35, playerDevices: ['led', 'refillPump'],
    lockedMode: 'off', startWaterPct: 0,
    // P42 (SPEC § 4.25): เล่นที่ 720x — ปั๊มเติมน้ำช้าลง 5 เท่า (สวิตช์ ~12 %/วินาทีจริง เท่า 144x เดิม), โดสยัง 4 L,
    // Mascot วิ่งช่วงละ 40 นาทีจำลอง (~3 วินาทีจริง); P43: แจ้ง (ไม่หยุดเกม) เมื่อน้ำ < 65 %, รั่วแรง 3 L/h
    playSpeed: 720, waterAlertPct: 65,
    cfg: { tank: { refillFlowLpm: 0.4 }, dose: { refillS: 600 }, challenges: { leakLph: 3, mascotEnterS: 2400, mascotExitS: 2400 } },
    // P38: คุมได้แค่น้ำกับแสง — อุณหภูมิ/ความชื้น/EC-pH ไม่มีผลต่อผักในด่านนี้
    ignoredFactors: ['temperature', 'air', 'nutrient'],
    // P43: วันแรกรั่ว 2 ครั้ง, วันที่ 2–5 วันละ 4 ครั้ง ครั้งละ 2–3 ชม. — Mascot มาเตะ ไม่เตือนล่วงหน้า
    challenges: { kinds: ['leak'], count: [18, 18], windowDays: [0, 4], salt: 1, surprise: true, days: [
      { day: 0, count: 2, hours: [2, 3], fromHour: 10, toHour: 20 },
      ...[1, 2, 3, 4].map((day) => ({ day, count: 4, hours: [2, 3] as const, fromHour: 6, toHour: 22 })),
    ] } },
  // P44 (SPEC § 4.27): นำของด่าน 1 มาใช้ — คุม Refill + LED + ปุ๋ย, อื่นปิดสนิท, 720x, แจ้งเตือนไม่หยุดเกม, Mascot รั่ววันละ 2 ครั้ง
  { id: 'L2', title: 'อาหารของผัก', description: 'เริ่มด้วยน้ำที่ปุ๋ยจาง ใส่ปุ๋ยให้ EC อยู่ในช่วงดี ระวัง Mascot ทำถังรั่ว — เติมน้ำแล้วปุ๋ยจะจางลง',
    // วัด Seed 1–5 (P48 วัดซ้ำหลังเพิ่มไฟดับ 2 ครั้ง ผลเท่าเดิม): สูตรดูแล (ใส่ปุ๋ย EC < 1.0 → 1.2) ต้นเล็กสุดถึง 24 g ที่ ~4.05 วัน (ไฟ 4.1 kWh);
    // ไม่ใส่ปุ๋ย (EC จางเหลือ ~0.2 จากรั่ว+เติมน้ำ) ≤ 20.2 g, ไม่เปิด LED 21.0 g ที่ 5 วัน → เป้า 24 g
    startBiomassG: 15, startDay: 23, targetG: 24, timeLimitDays: 5, energyBudgetKWh: 35, playerDevices: ['led', 'refillPump', 'nutrient'],
    lockedMode: 'off', playSpeed: 720, waterAlertPct: 65,
    // P44: นับ น้ำ + แสง + EC (pH ไม่มี pH Down → ไม่มีผลต่อผัก)
    ignoredFactors: ['temperature', 'air', 'ph'],
    // 720x: ปั๊มเติมน้ำ/ปุ๋ยช้าลง 5 เท่า โดสยาวขึ้น 5 เท่า (ปริมาณต่อโดสเท่าเดิม); เริ่ม EC 0.6 ต่ำกว่าช่วงดี
    cfg: { tank: { refillFlowLpm: 0.4 }, dose: { refillS: 600, nutrientS: 150 },
      nutrient: { initialEc: 0.6, doseFlowLpm: 0.01, phDropPerDoseMin: 0.004 },
      challenges: { leakLph: 3, mascotEnterS: 2400, mascotExitS: 2400, outageHours: [1, 2] } },
    // P48: Mascot ปิด Power Meter (ไฟดับ 1–2 ชม.) วันที่ 2 และ 4 ระหว่างรั่ว 2 ครั้ง
    challenges: { kinds: ['leak', 'powerOutage'], count: [12, 12], windowDays: [0, 4], salt: 2, surprise: true, days: [
      { day: 0, count: 2, hours: [2, 3], fromHour: 10, toHour: 20 },
      ...[2, 4].map((day) => ({ day, count: 2, hours: [2, 3] as const, fromHour: 6, toHour: 22 })),
      ...[1, 3].flatMap((day) => [
        { day, count: 1, hours: [2, 3] as const, fromHour: 6, toHour: 11 },
        { kind: 'powerOutage' as const, day, count: 1, hours: [1, 2] as const, fromHour: 11, toHour: 15 },
        { day, count: 1, hours: [2, 3] as const, fromHour: 15, toHour: 22 },
      ]),
    ] } },
  // P46 (SPEC § 4.29): แบบด่าน 1–2 — คุม Refill + LED + ปุ๋ย + Fan + Humidifier, pH Down ปิด, 720x, แจ้งเตือนไม่หยุดเกม,
  // Mascot พาคลื่นความร้อน 🔥 / อากาศแห้ง 🌵 มา (ไม่เตือน) และเตะถังรั่ววันละ 1 ครั้ง
  { id: 'L3', title: 'คลื่นความร้อน', description: 'Mascot พาความร้อนและอากาศแห้งมา ใช้พัดลม หมอก และลดไฟคุมอากาศ พร้อมดูแลน้ำและปุ๋ย',
    // P48 วัดใหม่ (พัดลม D201 + Cooling pad, ไฟดับ 4 ครั้ง) Seed 1–5: สูตรดูแล ต้นเล็กสุด 44.9 g ที่ 4.25 วัน (ไฟ 4.4 kWh);
    // ไม่ใช้พัดลม/หมอก ≤ 39.3 g, ไม่เปิด LED 39.3 g ที่ 5 วัน → เป้า 44 g (เดิม P46: 40 g)
    startBiomassG: 30, startDay: 28, targetG: 44, timeLimitDays: 5, energyBudgetKWh: 35, playerDevices: ['led', 'refillPump', 'nutrient', 'fan', 'humidifier'],
    lockedMode: 'off', playSpeed: 720, waterAlertPct: 65,
    // P46: นับ น้ำ + แสง + EC + อุณหภูมิ + อากาศ (pH ไม่มี pH Down → ไม่มีผลต่อผัก)
    ignoredFactors: ['ph'],
    cfg: { tank: { refillFlowLpm: 0.4 }, dose: { refillS: 600, nutrientS: 150 },
      nutrient: { doseFlowLpm: 0.01, phDropPerDoseMin: 0.004 },
      challenges: { leakLph: 3, mascotEnterS: 2400, mascotExitS: 2400, outageHours: [1, 2] } },
    // P48: Mascot ปิด Power Meter 4 ครั้ง (วันที่ 1, 2, 4, 5) ในช่วงที่ไม่ทับเหตุการณ์อื่น
    challenges: { kinds: ['leak', 'heatWave', 'dryAir', 'powerOutage'], count: [13, 13], windowDays: [0, 4], salt: 3, surprise: true, days: [
      { day: 0, count: 1, hours: [2, 3], fromHour: 10, toHour: 16 },
      { kind: 'powerOutage', day: 0, count: 1, hours: [1, 2], fromHour: 16, toHour: 20 },
      ...[1, 3].flatMap((day) => [
        { kind: 'powerOutage' as const, day, count: 1, hours: [1, 2] as const, fromHour: 6, toHour: 10 },
        { kind: 'heatWave' as const, day, count: 1, hours: [6, 6] as const, fromHour: 10, toHour: 19 },
        { day, count: 1, hours: [2, 3] as const, fromHour: 19, toHour: 23 },
      ]),
      { kind: 'dryAir', day: 2, count: 1, hours: [6, 8], fromHour: 7, toHour: 17 },
      { day: 2, count: 1, hours: [2, 3], fromHour: 17, toHour: 22 },
      { kind: 'dryAir', day: 4, count: 1, hours: [6, 8], fromHour: 7, toHour: 16 },
      { day: 4, count: 1, hours: [2, 3], fromHour: 16, toHour: 21 },
      { kind: 'powerOutage', day: 4, count: 1, hours: [1, 2], fromHour: 21, toHour: 24 },
    ] } },
  { id: 'L4', title: 'ฟาร์มของฉัน', description: 'ดูแลทุกอย่างเองตั้งแต่ต้นกล้าจนเก็บเกี่ยว 100 g ภายในงบไฟ',
    startBiomassG: 5, startDay: 14, targetG: 100, timeLimitDays: 35, energyBudgetKWh: 60,
    playerDevices: ['led', 'refillPump', 'nutrient', 'fan', 'humidifier', 'airPump', 'phDown'],
    lockedMode: 'helper', ignoredFactors: [], playSpeed: 144, waterAlertPct: null,
    // P48: ไฟดับ 1–2 ชม.; Mascot ปิด Power Meter 8 ครั้ง (ไม่เตือน) รวมกับเหตุการณ์สุ่มแบบเดิม (เตือน 6 ชม.)
    cfg: { challenges: { outageHours: [1, 2] } },
    challenges: { kinds: CHALLENGE_KINDS, count: [3, 4], windowDays: [3, 30], salt: 4,
      extraDays: [2, 6, 10, 14, 18, 22, 26, 30].map((day) => ({ kind: 'powerOutage' as const, surprise: true, day, count: 1, hours: [1, 2] as const, fromHour: 9, toHour: 17 })) } },
];

export const findLevel = (id: LevelId): LevelDef => LEVELS.find((l) => l.id === id)!;

export function levelInfo(l: LevelDef): LevelInfo {
  const { startDay: _d, challenges: _c, startWaterPct: _w, cfg: _cfg, ...info } = l;
  return { ...info, playerDevices: [...info.playerDevices] };
}

/** จุดเริ่มรอบของ Simulation จากด่าน */
export function levelRound(l: LevelDef): RoundStart {
  return { initialBiomassG: l.startBiomassG, startDay: l.startDay, challenges: l.challenges,
    ...(l.startWaterPct !== undefined ? { startWaterPct: l.startWaterPct } : {}),
    ...(l.ignoredFactors.length ? { ignoredFactors: l.ignoredFactors } : {}),
    ...(l.cfg ? { cfg: l.cfg } : {}),
    mission: { targetG: l.targetG, timeLimitS: l.timeLimitDays * 86_400, energyBudgetKWh: l.energyBudgetKWh } };
}
