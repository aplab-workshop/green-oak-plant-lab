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
    challenges: { kinds: ['leak'], count: [18, 18], windowDays: [0, 4], salt: 1, surprise: true, leakDays: [
      { day: 0, count: 2, hours: [2, 3], fromHour: 10, toHour: 20 },
      ...[1, 2, 3, 4].map((day) => ({ day, count: 4, hours: [2, 3] as const, fromHour: 6, toHour: 22 })),
    ] } },
  { id: 'L2', title: 'อาหารของผัก', description: 'ผักโตเร็ว กินปุ๋ยมาก คอยดู EC และเติมปุ๋ย',
    startBiomassG: 15, startDay: 23, targetG: 30, timeLimitDays: 8, energyBudgetKWh: 18, playerDevices: ['led', 'refillPump', 'nutrient'],
    lockedMode: 'helper', ignoredFactors: [], playSpeed: 144, waterAlertPct: null },
  { id: 'L3', title: 'คลื่นความร้อน', description: 'ไฟ LED ทำให้ร้อน ใช้พัดลมและหมอกคุมอากาศ',
    startBiomassG: 30, startDay: 28, targetG: 60, timeLimitDays: 10, energyBudgetKWh: 23, playerDevices: ['led', 'refillPump', 'nutrient', 'fan', 'humidifier'],
    lockedMode: 'helper', ignoredFactors: [], playSpeed: 144, waterAlertPct: null, challenges: { kinds: ['heatWave'], count: [1, 2], windowDays: [1, 7], salt: 3 } },
  { id: 'L4', title: 'ฟาร์มของฉัน', description: 'ดูแลทุกอย่างเองตั้งแต่ต้นกล้าจนเก็บเกี่ยว 100 g ภายในงบไฟ',
    startBiomassG: 5, startDay: 14, targetG: 100, timeLimitDays: 35, energyBudgetKWh: 60,
    playerDevices: ['led', 'refillPump', 'nutrient', 'fan', 'humidifier', 'airPump', 'phDown'],
    lockedMode: 'helper', ignoredFactors: [], playSpeed: 144, waterAlertPct: null, challenges: { kinds: CHALLENGE_KINDS, count: [3, 4], windowDays: [3, 30], salt: 4 } },
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
