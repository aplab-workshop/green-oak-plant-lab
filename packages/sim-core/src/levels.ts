import type { LevelId, LevelInfo } from '@gol/shared';
import type { RoundStart } from './simulation';

/** ด่านของเกม (SPEC § 4.6) — เป้าหมายตั้งจาก Simulation ตามสูตรใน GAME-GUIDE */
export interface LevelDef extends LevelInfo {
  /** Biomass เริ่มต้นต่อต้น (g) ก่อนสุ่ม ±initialBiomassSpread */
  startBiomassG: number;
  /** อายุต้นตอนเริ่ม (วันจำลองนับจากเพาะ) */
  startDay: number;
}

export const LEVELS: readonly LevelDef[] = [
  { id: 'L1', title: 'ต้นกล้าแรก', description: 'ให้แสงและน้ำ ดูแลต้นกล้าให้โตเป็น 2 เท่า',
    startBiomassG: 5, startDay: 14, targetG: 10, timeLimitDays: 8, energyBudgetKWh: 20, playerDevices: ['led', 'refillPump'] },
  { id: 'L2', title: 'อาหารของผัก', description: 'ผักโตเร็ว กินปุ๋ยมาก คอยดู EC และเติมปุ๋ย',
    startBiomassG: 15, startDay: 23, targetG: 30, timeLimitDays: 8, energyBudgetKWh: 18, playerDevices: ['led', 'refillPump', 'nutrient'] },
  { id: 'L3', title: 'คลื่นความร้อน', description: 'ไฟ LED ทำให้ร้อน ใช้พัดลมและหมอกคุมอากาศ',
    startBiomassG: 30, startDay: 28, targetG: 60, timeLimitDays: 9, energyBudgetKWh: 23, playerDevices: ['led', 'refillPump', 'nutrient', 'fan', 'humidifier'] },
  { id: 'L4', title: 'ฟาร์มของฉัน', description: 'ดูแลทุกอย่างเองตั้งแต่ต้นกล้าจนเก็บเกี่ยว 100 g ภายในงบไฟ',
    startBiomassG: 5, startDay: 14, targetG: 100, timeLimitDays: 35, energyBudgetKWh: 60,
    playerDevices: ['led', 'refillPump', 'nutrient', 'fan', 'humidifier', 'airPump', 'phDown'] },
];

export const findLevel = (id: LevelId): LevelDef => LEVELS.find((l) => l.id === id)!;

export function levelInfo(l: LevelDef): LevelInfo {
  const { startBiomassG: _b, startDay: _d, ...info } = l;
  return { ...info, playerDevices: [...info.playerDevices] };
}

/** จุดเริ่มรอบของ Simulation จากด่าน */
export function levelRound(l: LevelDef): RoundStart {
  return { initialBiomassG: l.startBiomassG, startDay: l.startDay,
    mission: { targetG: l.targetG, timeLimitS: l.timeLimitDays * 86_400, energyBudgetKWh: l.energyBudgetKWh } };
}
