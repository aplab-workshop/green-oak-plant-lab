import { describe, expect, it } from 'vitest';
import type { LabSnapshot, LevelInfo, PlantState } from '@gol/shared';
import { canControl, goalProgress, helperMessage } from '../src/game/gameModel';
import { formatRemaining, watchDials, watchGoal } from '../src/game/watchModel';
import { growthLevel, growthMeter } from '../src/game/growthModel';

const plant = (id: number, over: Partial<PlantState> = {}): PlantState => ({
  id, position: id - 1, ageDays: 14, stage: 'seedling', biomassG: 8, leafCount: 7, leafAreaCm2: 50, rootLengthCm: 6,
  hydration: 1, waterStress: 0, lightStress: 0, nutrientStress: 0, rootHealth: 1, damage: 0, health: 100,
  rootSubmerged: 1, supplyRatio: 1, demandLPerDay: 0.1, ppfd: 300, dliToday: 5, dliYesterday: 12, lightLoadH: 4, dryAirStress: 0, humidAirStress: 0, growthGPerH: 0.2, growthEfficiency: 1, ...over,
} as PlantState);

const L2: LevelInfo = { id: 'L2', title: 'อาหารของผัก', description: '', targetG: 30, startBiomassG: 15, timeLimitDays: 8, energyBudgetKWh: 18, playerDevices: ['led', 'refillPump', 'nutrient'], lockedMode: 'helper', ignoredFactors: [], playSpeed: 144, waterPausePct: null };

/** Snapshot ที่ทุกอย่างปกติ (กลางวัน ไฟ 80%) */
function snap(over: Partial<LabSnapshot> = {}, sensors: Partial<LabSnapshot['sensors']> = {}): LabSnapshot {
  return {
    game: { score: 500, elapsedS: 3600, averageHealth: 100, growthProgress: 0.1, harvestProgress: 0.25, deadPlantIds: [], totalPlants: 3, status: 'playing', endedAtS: null, canHarvest: false, harvestBonus: 0, yieldG: null, testRun: false, targetG: 30, timeLimitS: 8 * 86400, energyKWh: 2, energyBudgetKWh: 18, stars: 0, lostReason: null, overflowL: 0, overflowKWh: 0, overflowPenalty: 0, best: null },
    level: L2, levels: [],
    labId: 'lab01', runId: 1, at: 0, simTimeS: 36000, sim: { day: 23, minuteOfDay: 600 }, speed: 360, paused: false,
    plc: { kind: 'mock', mode: 'manual', connection: 'connected', lastOkAt: 0, latencyMs: 0, errorCount: 0, lastError: null },
    failsafe: false,
    commands: { fan: false, humidifier: false, ledPct: 80, refillPump: false, nutrientA: false, nutrientB: false, airPump: true, phDown: false },
    sensors: { airTempC: 23, rhPct: 65, ppfd: 320, waterTempC: 22, ph: 6.1, ecMsCm: 1.2, waterLevelPct: 85, flowLpm: 0, powerW: 100, vpdKPa: 0.9, dli: 8, ...sensors },
    tank: { waterLevelPct: 85, waterHeightCm: 17, volumeL: 34, capacityL: 40, overflowFlowLpm: 0, leakLph: 0, heightCm: 20, potBottomCm: 15, estimatedOxygen: 0.95 },
    plants: [plant(1, { biomassG: 12 }), plant(2, { biomassG: 9 }), plant(3, { biomassG: 15 })],
    scenario: null, disturbance: { leakLph: 0 }, doses: [], challenges: [], mascot: null, autoPause: { enabled: true, reason: null },
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
    const outage = snap({ challenges: [{ id: 1, kind: 'powerOutage', title: '⚡ ไฟดับ', status: 'active', startS: 0, endS: 9e9, repaired: false, repairable: false }] }, { waterLevelPct: 40 });
    expect(helperMessage(outage).text).toContain('ไฟดับ');
    const leak = snap({ challenges: [{ id: 1, kind: 'leak', title: '💧 ถังรั่ว', status: 'active', startS: 0, endS: null, repaired: false, repairable: true }] });
    expect(helperMessage(leak).text).toContain('ซ่อมถัง');
  });

  it('warns to rest the lights after 16 h of light load while LED is on (P30)', () => {
    const base = snap();
    const tired = { ...base, plants: base.plants.map((p) => ({ ...p, lightLoadH: 17 })) };
    expect(helperMessage(tired).text).toContain('เปิดไฟมา 17 ชม.');
    const off = { ...tired, commands: { ...tired.commands, ledPct: 0 }, sim: { ...tired.sim, minuteOfDay: 23 * 60 } };
    expect(helperMessage(off).text).not.toContain('เปิดไฟมา');
  });

  it('helper uses VPD: dry → turn on mist, humid while misting → turn it off (P33)', () => {
    const L3: LevelInfo = { id: 'L3', title: 'คลื่นความร้อน', description: '', targetG: 60, startBiomassG: 30, timeLimitDays: 10, energyBudgetKWh: 23, playerDevices: ['led', 'refillPump', 'nutrient', 'fan', 'humidifier'], lockedMode: 'helper', ignoredFactors: [], playSpeed: 144, waterPausePct: null };
    expect(helperMessage(snap({ level: L3 }, { vpdKPa: 2.0, rhPct: 40 })).text).toContain('เปิด 🌫️');
    const misting = snap({ level: L3, commands: { ...snap().commands, humidifier: true } }, { vpdKPa: 0.3, rhPct: 92 });
    expect(helperMessage(misting).text).toContain('ปิด 🌫️');
    expect(helperMessage(snap({ level: L3 }, { vpdKPa: 1.2, rhPct: 50 })).text).not.toContain('🌫️');
    // ด่านที่หมอกล็อก: บอกว่าผู้ช่วยดูแล
    expect(helperMessage(snap({}, { vpdKPa: 2.0, rhPct: 40 })).text).toContain('ผู้ช่วยฟาร์ม');
  });

  it('low pH tells the player to stop pH Down and dilute (P34)', () => {
    const L4: LevelInfo = { id: 'L4', title: 'ฟาร์มของฉัน', description: '', targetG: 100, startBiomassG: 5, timeLimitDays: 35, energyBudgetKWh: 60, playerDevices: ['led', 'refillPump', 'nutrient', 'fan', 'humidifier', 'airPump', 'phDown'], lockedMode: 'helper', ignoredFactors: [], playSpeed: 144, waterPausePct: null };
    const low = snap({ level: L4, commands: { ...snap().commands, phDown: true } }, { ph: 5.1 });
    expect(helperMessage(low).text).toContain('pH ต่ำเกิน');
    expect(helperMessage(low).text).toContain('ปิด ⚗️ pH Down');
    expect(helperMessage(snap({ level: L4 }, { ph: 5.1 })).text).not.toContain('ปิด ⚗️');
  });

  it('P37: self-stopping leaks ask for compensating refills, not repair; locked-off devices are not promised by the helper', () => {
    const L1: LevelInfo = { id: 'L1', title: 'ต้นกล้าแรก', description: '', targetG: 10, startBiomassG: 5, timeLimitDays: 10, energyBudgetKWh: 20, playerDevices: ['led', 'refillPump'], lockedMode: 'off', ignoredFactors: ['temperature', 'air', 'nutrient'], playSpeed: 144, waterPausePct: null };
    const leak = snap({ level: L1, challenges: [{ id: 1, kind: 'leak', title: '💧 ถังรั่ว', status: 'active', startS: 0, endS: 9e9, repaired: false, repairable: false }] }, { waterLevelPct: 60 });
    expect(helperMessage(leak)).toMatchObject({ tone: 'danger' });
    expect(helperMessage(leak).text).toContain('เติมน้ำชดเชย');
    expect(helperMessage(leak).text).not.toContain('ซ่อม');
    // ปิดอุปกรณ์แต่ยังนับปัจจัย → บอกว่าด่านนี้ไม่มีอุปกรณ์นั้น
    const counted = { ...L1, ignoredFactors: [] };
    expect(helperMessage(snap({ level: counted }, { airTempC: 29 })).text).toContain('ด่านนี้ไม่มีพัดลม');
    expect(helperMessage(snap({ level: counted }, { ecMsCm: 0.5 })).text).toContain('ด่านนี้ไม่ใช้ปุ๋ย');
  });

  it('P38: factors the level ignores never appear in helper advice', () => {
    const L1: LevelInfo = { id: 'L1', title: 'ต้นกล้าแรก', description: '', targetG: 10, startBiomassG: 5, timeLimitDays: 6, energyBudgetKWh: 20, playerDevices: ['led', 'refillPump'], lockedMode: 'off', ignoredFactors: ['temperature', 'air', 'nutrient'], playSpeed: 144, waterPausePct: null };
    for (const sensors of [{ airTempC: 30 }, { ecMsCm: 0.4 }, { ecMsCm: 2.4 }, { ph: 7.1 }, { ph: 5.1 }, { vpdKPa: 2.4, rhPct: 30 }]) {
      expect(helperMessage(snap({ level: L1 }, sensors))).toMatchObject({ tone: 'good' });
    }
  });

  it('overflow comes right after outage/leak and shows litres and penalty (P29)', () => {
    const base = snap();
    const over = { ...base, tank: { ...base.tank, overflowFlowLpm: 2 }, game: { ...base.game, overflowL: 3.4, overflowPenalty: 34 }, challenges: [{ id: 1, kind: 'heatWave' as const, title: '🔥 คลื่นความร้อน', status: 'warned' as const, startS: 9e9, endS: 9e9, repaired: false, repairable: false }] };
    const m = helperMessage(over);
    expect(m.tone).toBe('danger');
    expect(m.text).toContain('น้ำล้น');
    expect(m.text).toContain('3.4 L');
    expect(m.text).toContain('−34');
  });

  it('warns about upcoming events, then harvest, then low water', () => {
    const warned = snap({ challenges: [{ id: 1, kind: 'heatWave', title: '🔥 คลื่นความร้อน', status: 'warned', startS: 40000, endS: 60000, repaired: false, repairable: false }] });
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
    expect(helperMessage(snap({ commands: { ...snap().commands, ledPct: 0 } }, { ppfd: 120 })).text).toContain('กลางวันแสงน้อย');
    // P36: เที่ยงแดดแรง LED ปิดก็พอ ไม่ต้องเตือน; แดด+LED เกิน 350 ให้ลดไฟ
    expect(helperMessage(snap({ commands: { ...snap().commands, ledPct: 0 }, sim: { day: 23, minuteOfDay: 780, sunPpfd: 300 } }, { ppfd: 300 })).tone).toBe('good');
    expect(helperMessage(snap({ sim: { day: 23, minuteOfDay: 780, sunPpfd: 300 } }, { ppfd: 620 })).text).toContain('ลด 💡 LED');
    expect(helperMessage(snap({ sim: { day: 23, minuteOfDay: 23 * 60 } })).text).toContain('กลางคืน');
    expect(helperMessage(snap({ commands: { ...snap().commands, airPump: false } })).text).toContain('ปั๊มลม');
    expect(helperMessage(snap())).toMatchObject({ tone: 'good' });
  });

  it('canControl treats Free Play as owning every device', () => {
    expect(canControl(snap({ level: null }), 'fan')).toBe(true);
    expect(canControl(snap(), 'fan')).toBe(false);
  });
});

describe('level watch HUD (P31)', () => {
  const L1: LevelInfo = { id: 'L1', title: 'ต้นกล้าแรก', description: '', targetG: 10, startBiomassG: 5, timeLimitDays: 8, energyBudgetKWh: 20, playerDevices: ['led', 'refillPump'], lockedMode: 'helper', ignoredFactors: [], playSpeed: 144, waterPausePct: null };
  const L4: LevelInfo = { id: 'L4', title: 'ฟาร์มของฉัน', description: '', targetG: 100, startBiomassG: 5, timeLimitDays: 35, energyBudgetKWh: 60, playerDevices: ['led', 'refillPump', 'nutrient', 'fan', 'humidifier', 'airPump', 'phDown'], lockedMode: 'helper', ignoredFactors: [], playSpeed: 144, waterPausePct: null };

  it('picks dials from the devices the level unlocks', () => {
    expect(watchDials(snap({ level: L1 })).map((d) => d.key)).toEqual(['water', 'ppfd', 'lightLoad']);
    expect(watchDials(snap()).map((d) => d.key)).toEqual(['water', 'ppfd', 'lightLoad', 'ec']);
    expect(watchDials(snap({ level: L4 })).map((d) => d.key)).toEqual(['water', 'ppfd', 'lightLoad', 'ec', 'temp', 'air', 'ph']);
    expect(watchDials(snap({ level: null }))).toEqual([]);
  });

  it('colours and labels follow the recommended ranges', () => {
    const d = Object.fromEntries(watchDials(snap({}, { waterLevelPct: 60, ecMsCm: 2.4, ppfd: 320 })).map((x) => [x.key, x]));
    expect(d.water).toMatchObject({ status: 'warn', display: '60%', rangeText: '65–100%' });
    expect(d.ec).toMatchObject({ status: 'alarm', display: '2.40', rangeText: '0.8–1.6' });
    expect(d.ppfd).toMatchObject({ status: 'ok', rangeText: '200–350' });
    expect(d.lightLoad).toMatchObject({ status: 'ok', display: '4 ชม.' });
    const temp = watchDials(snap({ level: L4 }, { airTempC: 27 })).find((x) => x.key === 'temp')!;
    expect(temp).toMatchObject({ status: 'warn', rangeText: '15–25°C' });
  });

  it('PPFD is grey "dark" at night with lights off; light load uses the most tired living plant', () => {
    const night = snap({ sim: { day: 23, minuteOfDay: 23 * 60 }, commands: { ...snap().commands, ledPct: 0 } }, { ppfd: 0 });
    expect(watchDials(night).find((x) => x.key === 'ppfd')).toMatchObject({ status: 'neutral', display: 'มืด' });
    const base = snap();
    const tired = { ...base, plants: [{ ...base.plants[0]!, lightLoadH: 17 }, { ...base.plants[1]!, lightLoadH: 30, damage: 1 }, base.plants[2]!] };
    expect(watchDials(tired).find((x) => x.key === 'lightLoad')).toMatchObject({ value: 17, status: 'warn' });
  });

  it('air dial explains VPD as dry / ok / humid with RH below (P33)', () => {
    const air = (vpdKPa: number, rhPct: number) => watchDials(snap({ level: L4 }, { vpdKPa, rhPct })).find((x) => x.key === 'air')!;
    expect(air(1.0, 65)).toMatchObject({ display: 'เหมาะสม', status: 'ok', rangeText: 'RH 65%' });
    expect(air(2.0, 40)).toMatchObject({ display: 'แห้ง', status: 'warn' });
    expect(air(2.6, 25)).toMatchObject({ display: 'แห้ง', status: 'alarm' });
    expect(air(0.35, 92)).toMatchObject({ display: 'ชื้นจัด', status: 'warn' });
  });

  it('goal card shows smallest living plant, start weight and time left', () => {
    expect(watchGoal(snap())).toEqual({ targetG: 30, minG: 9, startG: 15, ratio: 0.3, remainingS: 8 * 86400 - 3600, limitDays: 8 });
    expect(watchGoal(snap({ level: null }))).toBeNull();
    expect(formatRemaining(8 * 86400 - 3600)).toBe('7 วัน 23 ชม.');
    expect(formatRemaining(5 * 3600 + 59)).toBe('5 ชม.');
  });
});

describe('growth meter (P35)', () => {
  it('classifies efficiency into 4 levels and night rest', () => {
    expect(growthLevel(1, false)).toBe('good');
    expect(growthLevel(0.7, false)).toBe('good');
    expect(growthLevel(0.5, false)).toBe('slow');
    expect(growthLevel(0.1, false)).toBe('verySlow');
    expect(growthLevel(0, false)).toBe('none');
    expect(growthLevel(0, true)).toBe('night');
    expect(growthLevel(0.5, true)).toBe('slow');
  });

  it('uses server harvest progress and the smallest living plant rate', () => {
    const base = snap();
    const g = growthMeter({ ...base, plants: [{ ...base.plants[0]!, growthGPerH: 0.3, growthEfficiency: 1 }, { ...base.plants[1]!, growthGPerH: 0.08, growthEfficiency: 0.4 }, base.plants[2]!] })!;
    expect(g).toMatchObject({ progress: 0.25, ready: false, rateGPerH: 0.08, level: 'slow', label: 'โตช้า', hourKey: 10 });
    const night = growthMeter(snap({ sim: { day: 23, minuteOfDay: 23 * 60 }, commands: { ...base.commands, ledPct: 0 }, plants: base.plants.map((p) => ({ ...p, growthGPerH: 0, growthEfficiency: 0 })) }))!;
    expect(night.level).toBe('night');
    const ready = growthMeter(snap({ game: { ...base.game, harvestProgress: 1, canHarvest: true } }))!;
    expect(ready.ready).toBe(true);
    expect(growthMeter(snap({ game: { ...base.game, status: 'ready' } }))!).toMatchObject({ rateGPerH: 0, level: 'none' });
  });
});

