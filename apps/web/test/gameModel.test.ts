import { describe, expect, it } from 'vitest';
import type { HistorySample, LabSnapshot, LevelInfo, PlantState } from '@gol/shared';
import { canControl, gauges, goalProgress, helperMessage, lightStatus, trendOf } from '../src/game/gameModel';

const plant = (id: number, over: Partial<PlantState> = {}): PlantState => ({
  id, position: id - 1, ageDays: 14, stage: 'seedling', biomassG: 8, leafCount: 7, leafAreaCm2: 50, rootLengthCm: 6,
  hydration: 1, waterStress: 0, lightStress: 0, nutrientStress: 0, rootHealth: 1, damage: 0, health: 100,
  rootSubmerged: 1, supplyRatio: 1, demandLPerDay: 0.1, ppfd: 300, dliToday: 5, dliYesterday: 12, ...over,
} as PlantState);

const L2: LevelInfo = { id: 'L2', title: 'อาหารของผัก', description: '', targetG: 30, timeLimitDays: 8, energyBudgetKWh: 18, playerDevices: ['led', 'refillPump', 'nutrient'] };

/** Snapshot ที่ทุกอย่างปกติ (กลางวัน ไฟ 80%) */
function snap(over: Partial<LabSnapshot> = {}, sensors: Partial<LabSnapshot['sensors']> = {}): LabSnapshot {
  return {
    game: { score: 500, elapsedS: 3600, averageHealth: 100, growthProgress: 0.1, deadPlantIds: [], totalPlants: 3, status: 'playing', endedAtS: null, canHarvest: false, harvestBonus: 0, yieldG: null, testRun: false, targetG: 30, timeLimitS: 8 * 86400, energyKWh: 2, energyBudgetKWh: 18, stars: 0, lostReason: null, best: null },
    level: L2, levels: [],
    labId: 'lab01', runId: 1, at: 0, simTimeS: 36000, sim: { day: 23, minuteOfDay: 600 }, speed: 360, paused: false,
    plc: { kind: 'mock', mode: 'manual', connection: 'connected', lastOkAt: 0, latencyMs: 0, errorCount: 0, lastError: null },
    failsafe: false,
    commands: { fan: false, humidifier: false, ledPct: 80, refillPump: false, nutrientA: false, nutrientB: false, airPump: true, phDown: false },
    sensors: { airTempC: 23, rhPct: 65, ppfd: 320, waterTempC: 22, ph: 6.1, ecMsCm: 1.2, waterLevelPct: 85, flowLpm: 0, powerW: 100, vpdKPa: 0.9, dli: 8, ...sensors },
    tank: { waterLevelPct: 85, waterHeightCm: 17, volumeL: 34, capacityL: 40, overflowFlowLpm: 0, heightCm: 20, potBottomCm: 15, estimatedOxygen: 0.95 },
    plants: [plant(1, { biomassG: 12 }), plant(2, { biomassG: 9 }), plant(3, { biomassG: 15 })],
    scenario: null, disturbance: { leakLph: 0 }, doses: [], challenges: [], autoPause: { enabled: true, reason: null },
    ...over,
  };
}

const h = (over: Partial<HistorySample>): HistorySample => ({
  simTimeS: 0, waterLevelPct: 80, airTempC: 23, rhPct: 65, ppfd: 300, ecMsCm: 1.2, ph: 6.1,
  avgHydration: 1, avgWaterStress: 0, avgHealth: 100, avgBiomassG: 10, ...over,
} as HistorySample);

describe('gauges', () => {
  it('shows 4 traffic-light gauges, plus pH only when the level unlocks pH Down', () => {
    const g = gauges(snap(), []);
    expect(g.map((x) => x.key)).toEqual(['water', 'nutrient', 'air', 'light']);
    expect(g.every((x) => x.status === 'ok')).toBe(true);
    const l4 = { ...L2, id: 'L4' as const, playerDevices: [...L2.playerDevices, 'phDown' as const] };
    expect(gauges(snap({ level: l4 }), []).map((x) => x.key)).toContain('ph');
    expect(gauges(snap({ level: null }), []).map((x) => x.key)).toContain('ph'); // Free Play คุมได้ทุกอย่าง
  });

  it('colours from shared ranges; air uses the worse of temperature and humidity', () => {
    const g = gauges(snap({}, { waterLevelPct: 50, ecMsCm: 0.7, airTempC: 23, rhPct: 35 }), []);
    expect(g.find((x) => x.key === 'water')!.status).toBe('alarm');
    expect(g.find((x) => x.key === 'nutrient')!.status).toBe('warn');
    expect(g.find((x) => x.key === 'air')!.status).toBe('alarm');
  });

  it('light: lit = PPFD range, daytime off = warn, night off = neutral', () => {
    expect(lightStatus(320, 80, 600)).toBe('ok');
    expect(lightStatus(450, 100, 600)).toBe('warn');
    expect(lightStatus(0, 0, 600)).toBe('warn');
    expect(lightStatus(0, 0, 23 * 60)).toBe('neutral');
  });

  it('trend arrows come from the last two history points', () => {
    expect(trendOf([], 'waterLevelPct', 0.3)).toBe('flat');
    expect(trendOf([h({ waterLevelPct: 80 }), h({ waterLevelPct: 78 })], 'waterLevelPct', 0.3)).toBe('down');
    expect(trendOf([h({ ecMsCm: 1.2 }), h({ ecMsCm: 1.25 })], 'ecMsCm', 0.01)).toBe('up');
    expect(trendOf([h({ ph: 6.1 }), h({ ph: 6.105 })], 'ph', 0.01)).toBe('flat');
  });
});

describe('goalProgress', () => {
  it('uses the smallest surviving plant', () => {
    expect(goalProgress(snap())).toMatchObject({ minG: 9, targetG: 30, ratio: 0.3 });
    const s = snap();
    s.game = { ...s.game, deadPlantIds: [2] };
    expect(goalProgress(s).minG).toBe(12);
  });
});

describe('helperMessage priority', () => {
  it('round status first', () => {
    const s = snap();
    expect(helperMessage({ ...s, game: { ...s.game, status: 'ready' } }).text).toContain('เริ่มปลูก');
    expect(helperMessage({ ...s, game: { ...s.game, status: 'lost' } }).tone).toBe('danger');
  });

  it('fail-safe, outage and leak beat everything else while playing', () => {
    expect(helperMessage(snap({ failsafe: true }, { waterLevelPct: 40 })).text).toContain('Fail-safe');
    const outage = snap({ challenges: [{ id: 1, kind: 'powerOutage', title: '⚡ ไฟดับ', status: 'active', startS: 0, endS: 9e9, repaired: false }] }, { waterLevelPct: 40 });
    expect(helperMessage(outage).text).toContain('ไฟดับ');
    const leak = snap({ challenges: [{ id: 1, kind: 'leak', title: '💧 ถังรั่ว', status: 'active', startS: 0, endS: null, repaired: false }] });
    expect(helperMessage(leak).text).toContain('ซ่อมถัง');
  });

  it('warns about upcoming events, then harvest, then low water', () => {
    const warned = snap({ challenges: [{ id: 1, kind: 'heatWave', title: '🔥 คลื่นความร้อน', status: 'warned', startS: 40000, endS: 60000, repaired: false }] });
    expect(helperMessage(warned).text).toContain('พัดลม');
    const s = snap();
    expect(helperMessage({ ...s, game: { ...s.game, canHarvest: true } }).text).toContain('เก็บเกี่ยว');
    expect(helperMessage(snap({}, { waterLevelPct: 60 }))).toMatchObject({ tone: 'warn' });
    expect(helperMessage(snap({}, { waterLevelPct: 60 })).text).toContain('🚰 เติมน้ำ');
  });

  it('points at the helper for locked devices and at buttons the player owns', () => {
    expect(helperMessage(snap({}, { ecMsCm: 0.6 })).text).toContain('🧪 ใส่ปุ๋ย'); // L2 คุมปุ๋ยได้
    const l1 = { ...L2, id: 'L1' as const, playerDevices: ['led', 'refillPump'] as LevelInfo['playerDevices'] };
    expect(helperMessage(snap({ level: l1 }, { ecMsCm: 0.6 })).text).toContain('ผู้ช่วยฟาร์ม');
    expect(helperMessage(snap({ level: l1 }, { ph: 6.9 })).text).toContain('ผู้ช่วยฟาร์ม');
  });

  it('thirsty plant, light schedule, air pump and the all-good message', () => {
    const thirsty = snap({ plants: [plant(1), plant(2, { waterStress: 0.5 })] });
    expect(helperMessage(thirsty).text).toContain('ต้นที่ 2');
    expect(helperMessage(snap({ commands: { ...snap().commands, ledPct: 0 } })).text).toContain('กลางวัน');
    expect(helperMessage(snap({ sim: { day: 23, minuteOfDay: 23 * 60 } })).text).toContain('กลางคืน');
    expect(helperMessage(snap({ commands: { ...snap().commands, airPump: false } })).text).toContain('ปั๊มลม');
    expect(helperMessage(snap())).toMatchObject({ tone: 'good' });
  });

  it('canControl treats Free Play as owning every device', () => {
    expect(canControl(snap({ level: null }), 'fan')).toBe(true);
    expect(canControl(snap(), 'fan')).toBe(false);
  });
});
