import { describe, expect, it } from 'vitest';
import type { LabSnapshot, LevelInfo, PlantState } from '@gol/shared';
import { canControl, goalProgress, helperMessage } from '../src/game/gameModel';

const plant = (id: number, over: Partial<PlantState> = {}): PlantState => ({
  id, position: id - 1, ageDays: 14, stage: 'seedling', biomassG: 8, leafCount: 7, leafAreaCm2: 50, rootLengthCm: 6,
  hydration: 1, waterStress: 0, lightStress: 0, nutrientStress: 0, rootHealth: 1, damage: 0, health: 100,
  rootSubmerged: 1, supplyRatio: 1, demandLPerDay: 0.1, ppfd: 300, dliToday: 5, dliYesterday: 12, ...over,
} as PlantState);

const L2: LevelInfo = { id: 'L2', title: 'อาหารของผัก', description: '', targetG: 30, timeLimitDays: 8, energyBudgetKWh: 18, playerDevices: ['led', 'refillPump', 'nutrient'] };

/** Snapshot ที่ทุกอย่างปกติ (กลางวัน ไฟ 80%) */
function snap(over: Partial<LabSnapshot> = {}, sensors: Partial<LabSnapshot['sensors']> = {}): LabSnapshot {
  return {
    game: { score: 500, elapsedS: 3600, averageHealth: 100, growthProgress: 0.1, deadPlantIds: [], totalPlants: 3, status: 'playing', endedAtS: null, canHarvest: false, harvestBonus: 0, yieldG: null, testRun: false, targetG: 30, timeLimitS: 8 * 86400, energyKWh: 2, energyBudgetKWh: 18, stars: 0, lostReason: null, overflowL: 0, overflowKWh: 0, overflowPenalty: 0, best: null },
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

  it('overflow comes right after outage/leak and shows litres and penalty (P29)', () => {
    const base = snap();
    const over = { ...base, tank: { ...base.tank, overflowFlowLpm: 2 }, game: { ...base.game, overflowL: 3.4, overflowPenalty: 34 }, challenges: [{ id: 1, kind: 'heatWave' as const, title: '🔥 คลื่นความร้อน', status: 'warned' as const, startS: 9e9, endS: 9e9, repaired: false }] };
    const m = helperMessage(over);
    expect(m.tone).toBe('danger');
    expect(m.text).toContain('น้ำล้น');
    expect(m.text).toContain('3.4 L');
    expect(m.text).toContain('−34');
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
