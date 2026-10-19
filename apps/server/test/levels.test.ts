import { describe, expect, it } from 'vitest';
import type { ActuatorCommands, SensorReadings } from '@gol/shared';
import { makeConfig } from '@gol/sim-core';
import { LabSession } from '../src/lab/LabSession';
import { applyFarmHelper } from '../src/lab/farmHelper';
import { MockPlcAdapter } from '../src/plc/MockPlcAdapter';
import { FakeClock, runReal, type TestLab } from './helpers';

/** Lab ที่เริ่มด่าน L1 เหมือน LabManager; growthRatePerDay สูงเพื่อให้ถึงเป้าเร็ว (ทดสอบ Flow ไม่ใช่การโต) */
function levelLab(mode: 'manual' | 'auto' = 'manual', fast = false): TestLab {
  const clock = new FakeClock();
  const mock = new MockPlcAdapter(mode, clock.now);
  const cfg = fast ? makeConfig({ plant: { growthRatePerDay: 20 } }) : makeConfig();
  const lab = new LabSession({ labId: 'lab01', adapter: mock, now: clock.now, sim: { cfg }, sensorNoise: false, level: 'L1' });
  return { lab, mock, clock };
}

async function winL1(t: TestLab): Promise<void> {
  await t.lab.handle({ type: 'startGame' });
  await t.lab.handle({ type: 'setSpeed', speed: 3600 });
  if (t.mock.mode === 'manual') await t.lab.handle({ type: 'setManualLed', value: 80 });
  for (let i = 0; i < 40 && t.lab.snapshot().game.status === 'playing'; i++) {
    await runReal(t, 1000);
    if (t.lab.snapshot().game.canHarvest) await t.lab.handle({ type: 'harvest' });
  }
}

describe('Levels on LabSession — P21 (SPEC § 4.6)', () => {
  it('starts at L1 with only L1 unlocked; locked levels and devices are rejected', async () => {
    const t = levelLab();
    const snap = t.lab.snapshot();
    expect(snap.level).toMatchObject({ id: 'L1', targetG: 10, timeLimitDays: 8, playerDevices: ['led', 'refillPump'] });
    expect(snap.levels.map((l) => [l.id, l.unlocked])).toEqual([['L1', true], ['L2', false], ['L3', false], ['L4', false]]);
    expect(snap.game).toMatchObject({ status: 'ready', targetG: 10, timeLimitS: 8 * 86_400 });
    await expect(t.lab.handle({ type: 'selectLevel', levelId: 'L2' })).rejects.toMatchObject({ statusCode: 409 });
    for (const key of ['fan', 'humidifier', 'nutrientA', 'nutrientB', 'airPump'] as const) {
      await expect(t.lab.handle({ type: 'setManualBit', key, value: true })).rejects.toMatchObject({ statusCode: 409 });
    }
    await t.lab.handle({ type: 'setManualBit', key: 'refillPump', value: true });
    expect(t.lab.snapshot().commands.refillPump).toBe(true);
  });

  it('farm helper keeps locked devices running (Air Pump) even if the PLC turns them off; off during Fail-safe', async () => {
    const t = levelLab();
    t.mock.memory.setM(105, false); // Air Pump ใน PLC ปิด
    await t.lab.poll();
    expect(t.lab.snapshot().commands.airPump).toBe(true);
    t.mock.setMode('offline');
    await t.lab.poll();
    t.clock.t += 4000; t.lab.tick(0);
    expect(t.lab.snapshot()).toMatchObject({ failsafe: true, commands: { fan: false, refillPump: false } });
  });

  it('farm helper rules use Ladder-sample thresholds with hysteresis only for locked devices', () => {
    const off: ActuatorCommands = { fan: false, humidifier: false, refillPump: false, nutrientA: false, nutrientB: false, airPump: false, phDown: false, ledPct: 40 };
    const s = (over: Partial<SensorReadings>) => ({ airTempC: 25, rhPct: 60, ecMsCm: 1.1, waterLevelPct: 80, ...over }) as SensorReadings;
    const hot = applyFarmHelper(off, off, s({ airTempC: 26, rhPct: 50, ecMsCm: 0.9, waterLevelPct: 60 }), ['led']);
    // Nutrient / pH Down ที่ล็อก ผู้ช่วยสั่งเป็นโดสใน LabSession (P22) จึงปิดไว้ที่นี่
    expect(hot).toEqual({ fan: true, humidifier: true, refillPump: true, nutrientA: false, nutrientB: false, airPump: true, phDown: false, ledPct: 40 });
    // อยู่ในช่วง Hysteresis → คงค่าเดิม
    expect(applyFarmHelper(off, hot, s({}), ['led'])).toEqual(hot);
    // อุปกรณ์ที่ผู้เล่นคุม → ใช้ค่าจาก PLC
    const player = applyFarmHelper(off, off, s({ airTempC: 30, waterLevelPct: 10 }), ['led', 'refillPump', 'nutrient', 'fan', 'humidifier', 'airPump']);
    expect(player).toEqual(off);
  });

  it('winning L1 unlocks L2 and records stars; selecting levels resets to ready', async () => {
    const t = levelLab('manual', true);
    await winL1(t);
    const won = t.lab.snapshot();
    expect(won.game).toMatchObject({ status: 'won', testRun: false });
    expect(won.game.stars).toBeGreaterThanOrEqual(1);
    expect(won.levels[0]).toMatchObject({ id: 'L1', bestStars: won.game.stars });
    expect(won.levels[1]).toMatchObject({ id: 'L2', unlocked: true });
    await t.lab.handle({ type: 'selectLevel', levelId: 'L2' });
    const l2 = t.lab.snapshot();
    expect(l2).toMatchObject({ paused: true, level: { id: 'L2' }, game: { status: 'ready', targetG: 30, best: null } });
    expect(l2.plants.reduce((a, p) => a + p.biomassG, 0) / 6).toBeCloseTo(15, -0.5);
    expect(l2.levels[0]!.bestStars).toBe(won.game.stars);
    await t.lab.handle({ type: 'selectLevel', levelId: 'free' });
    expect(t.lab.snapshot()).toMatchObject({ level: null, game: { status: 'ready', targetG: 100, timeLimitS: null } });
    await t.lab.handle({ type: 'selectLevel', levelId: 'L1' });
    expect(t.lab.snapshot().game.best).toMatchObject({ score: won.game.score });
    await t.lab.handle({ type: 'applyScenario', scenarioId: 'water-shortage' });
    expect(t.lab.snapshot()).toMatchObject({ level: null, scenario: { id: 'water-shortage' } });
  });

  it('a test run (Auto) win does not unlock the next level', async () => {
    const t = levelLab('auto', true);
    await winL1(t);
    const snap = t.lab.snapshot();
    expect(snap.game).toMatchObject({ status: 'won', testRun: true });
    expect(snap.levels[1]!.unlocked).toBe(false);
    expect(snap.levels[0]!.bestStars).toBe(0);
  });
});
