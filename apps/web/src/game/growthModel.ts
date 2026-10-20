import { isDaytime, isPlantDead, type LabSnapshot } from '@gol/shared';

/**
 * แถบ Growth (SPEC § 4.18) — Pure: แปลง Snapshot เป็นความคืบหน้าสู่เก็บเกี่ยวและระดับการโต
 */

export type GrowthLevel = 'good' | 'slow' | 'verySlow' | 'none' | 'night';

export interface GrowthMeterData {
  /** 0–1 จาก Server (`game.harvestProgress`) */
  progress: number;
  ready: boolean;
  /** อัตราโตของต้นเล็กสุดที่รอด (g/ชม.จำลอง) */
  rateGPerH: number;
  efficiency: number;
  level: GrowthLevel;
  label: string;
  color: string;
  /** ชั่วโมงจำลอง — ใช้เป็น key ของป้ายลอย (ผูกกับเวลาจำลอง) */
  hourKey: number;
}

const LEVELS: Record<GrowthLevel, { label: string; color: string }> = {
  good: { label: 'โตตามปกติดี', color: '#059669' },
  slow: { label: 'โตช้า', color: '#d97706' },
  verySlow: { label: 'ช้ามาก', color: '#ea580c' },
  none: { label: 'ไม่โตเลย', color: '#dc2626' },
  night: { label: '🌙 พักกลางคืน', color: '#475569' },
};

export function growthLevel(efficiency: number, night: boolean): GrowthLevel {
  if (efficiency >= 0.7) return 'good';
  if (efficiency >= 0.35) return 'slow';
  if (efficiency > 0.02) return 'verySlow';
  return night ? 'night' : 'none';
}

export function growthMeter(s: LabSnapshot): GrowthMeterData | null {
  const alive = s.plants.filter((p) => !isPlantDead(p, s.game.deadPlantIds));
  if (!alive.length) return null;
  const smallest = alive.reduce((a, b) => (b.biomassG < a.biomassG ? b : a));
  const night = s.commands.ledPct <= 0 && !isDaytime(s.sim.minuteOfDay);
  const playing = s.game.status === 'playing';
  const efficiency = playing ? smallest.growthEfficiency : 0;
  const level = growthLevel(efficiency, night);
  return {
    progress: s.game.harvestProgress,
    ready: s.game.harvestProgress >= 1,
    rateGPerH: playing ? Math.max(0, smallest.growthGPerH) : 0,
    efficiency,
    level,
    ...LEVELS[level],
    hourKey: Math.floor(s.simTimeS / 3600),
  };
}
