import type { LevelId, LevelInfo } from '@gol/shared';
import type { RoundStart } from './simulation';
import { CHALLENGE_KINDS, type ChallengeSpec } from './challenges';

/** ด่านของเกม (SPEC § 4.6) — เป้าหมายตั้งจาก Simulation ตามสูตรใน GAME-GUIDE */
export interface LevelDef extends LevelInfo {
  /** อายุต้นตอนเริ่ม (วันจำลองนับจากเพาะ) */
  startDay: number;
  /** เหตุการณ์ท้าทายของด่าน (SPEC § 4.8) — ไม่มี = ไม่มีเหตุการณ์ */
  challenges?: ChallengeSpec;
  /** ระดับน้ำเริ่มรอบ (%) — ไม่มี = ค่าปกติใน Config (P37) */
  startWaterPct?: number;
}

export const LEVELS: readonly LevelDef[] = [
  // P37 (SPEC § 4.20): คุม Refill + LED, อุปกรณ์อื่นปิดสนิท, เริ่มถังว่าง, รั่วเป็นช่วง ๆ หยุดเอง
  { id: 'L1', title: 'ต้นกล้าแรก', description: 'เติมน้ำจากถังว่างและคุมแสงตามช่วงเวลา (แดด + LED) ระวังน้ำรั่วและน้ำล้น',
    // P38 วัดแล้ว (ไม่นับความร้อน): สูตรดูแลถึง 10 g ≤ 5.03 วัน, แดดอย่างเดียวไม่เปิด LED ≥ 7.1 วัน
    // → 6 วัน: ต้องคุมไฟจริงจึงผ่าน และสูตรดูแลเหลือเวลา ~16 %
    startBiomassG: 5, startDay: 14, targetG: 10, timeLimitDays: 6, energyBudgetKWh: 20, playerDevices: ['led', 'refillPump'],
    lockedMode: 'off', startWaterPct: 0,
    // P38: คุมได้แค่น้ำกับแสง — อุณหภูมิ/ความชื้น/EC-pH ไม่มีผลต่อผักในด่านนี้
    ignoredFactors: ['temperature', 'air', 'nutrient'],
    challenges: { kinds: ['leak'], count: [2, 3], windowDays: [1, 6], salt: 1, leakHours: [4, 6] } },
  { id: 'L2', title: 'อาหารของผัก', description: 'ผักโตเร็ว กินปุ๋ยมาก คอยดู EC และเติมปุ๋ย',
    startBiomassG: 15, startDay: 23, targetG: 30, timeLimitDays: 8, energyBudgetKWh: 18, playerDevices: ['led', 'refillPump', 'nutrient'],
    lockedMode: 'helper', ignoredFactors: [] },
  { id: 'L3', title: 'คลื่นความร้อน', description: 'ไฟ LED ทำให้ร้อน ใช้พัดลมและหมอกคุมอากาศ',
    startBiomassG: 30, startDay: 28, targetG: 60, timeLimitDays: 10, energyBudgetKWh: 23, playerDevices: ['led', 'refillPump', 'nutrient', 'fan', 'humidifier'],
    lockedMode: 'helper', ignoredFactors: [], challenges: { kinds: ['heatWave'], count: [1, 2], windowDays: [1, 7], salt: 3 } },
  { id: 'L4', title: 'ฟาร์มของฉัน', description: 'ดูแลทุกอย่างเองตั้งแต่ต้นกล้าจนเก็บเกี่ยว 100 g ภายในงบไฟ',
    startBiomassG: 5, startDay: 14, targetG: 100, timeLimitDays: 35, energyBudgetKWh: 60,
    playerDevices: ['led', 'refillPump', 'nutrient', 'fan', 'humidifier', 'airPump', 'phDown'],
    lockedMode: 'helper', ignoredFactors: [], challenges: { kinds: CHALLENGE_KINDS, count: [3, 4], windowDays: [3, 30], salt: 4 } },
];

export const findLevel = (id: LevelId): LevelDef => LEVELS.find((l) => l.id === id)!;

export function levelInfo(l: LevelDef): LevelInfo {
  const { startDay: _d, challenges: _c, startWaterPct: _w, ...info } = l;
  return { ...info, playerDevices: [...info.playerDevices] };
}

/** จุดเริ่มรอบของ Simulation จากด่าน */
export function levelRound(l: LevelDef): RoundStart {
  return { initialBiomassG: l.startBiomassG, startDay: l.startDay, challenges: l.challenges,
    ...(l.startWaterPct !== undefined ? { startWaterPct: l.startWaterPct } : {}),
    ...(l.ignoredFactors.length ? { ignoredFactors: l.ignoredFactors } : {}),
    mission: { targetG: l.targetG, timeLimitS: l.timeLimitDays * 86_400, energyBudgetKWh: l.energyBudgetKWh } };
}
