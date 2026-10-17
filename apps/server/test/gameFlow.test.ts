import { describe, expect, it } from 'vitest';
import { makeConfig } from '@gol/sim-core';
import { LabCommand } from '@gol/shared';
import { loadConfig } from '../src/config';
import { makeLab, runReal } from './helpers';

describe('Garden game flow on LabSession — P20 (SPEC § 4.5)', () => {
  it('new and reset rounds wait in ready with time stopped until startGame', async () => {
    const t = makeLab('lab01', 'manual', 1, {}, false);
    const start = t.lab.snapshot();
    expect(start).toMatchObject({ paused: true, game: { status: 'ready' } });
    await expect(t.lab.handle({ type: 'resume' })).rejects.toMatchObject({ statusCode: 409 });
    await t.lab.handle({ type: 'setSpeed', speed: 1440 });
    await runReal(t, 3000);
    expect(t.lab.snapshot().simTimeS).toBe(start.simTimeS);
    await t.lab.handle({ type: 'startGame' });
    await expect(t.lab.handle({ type: 'startGame' })).rejects.toMatchObject({ statusCode: 409 });
    await runReal(t, 1000);
    expect(t.lab.snapshot()).toMatchObject({ paused: false, game: { status: 'playing' } });
    expect(t.lab.snapshot().simTimeS - start.simTimeS).toBe(1440);
    await t.lab.handle({ type: 'reset' });
    expect(t.lab.snapshot()).toMatchObject({ paused: true, game: { status: 'ready', elapsedS: 0 } });
    await t.lab.handle({ type: 'applyScenario', scenarioId: 'water-shortage' });
    expect(t.lab.snapshot()).toMatchObject({ paused: true, game: { status: 'ready' } });
  });

  it('rejects harvest before plants are ready; harvest wins, stops time and records Best', async () => {
    const early = makeLab('lab01', 'manual', 1, {}, false);
    await early.lab.handle({ type: 'startGame' });
    await expect(early.lab.handle({ type: 'harvest' })).rejects.toMatchObject({ statusCode: 409 });

    // harvestAtG ต่ำกว่า Biomass เริ่มต้น → พร้อมเก็บหลัง step แรก (ทดสอบ Flow ไม่ใช่การโต)
    const t = makeLab('lab01', 'manual', 1, { cfg: makeConfig({ plant: { harvestAtG: 3 }, game: { recordMinS: 10 } }) }, false);
    await t.lab.poll();
    await t.lab.handle({ type: 'startGame' });
    await t.lab.handle({ type: 'setSpeed', speed: 60 });
    await runReal(t, 2000);
    expect(t.lab.snapshot().game.canHarvest).toBe(true);
    await t.lab.handle({ type: 'harvest' });
    const won = t.lab.snapshot();
    expect(won).toMatchObject({ paused: true, game: { status: 'won', canHarvest: false, testRun: false } });
    expect(won.game.yieldG).toBeGreaterThan(0);
    expect(won.game.best).toEqual({ score: won.game.score, elapsedS: won.game.elapsedS });
    expect(t.lab.events.list().some((e) => e.kind === 'game.won')).toBe(true);
    await expect(t.lab.handle({ type: 'resume' })).rejects.toMatchObject({ statusCode: 409 });
    await runReal(t, 2000);
    expect(t.lab.snapshot().simTimeS).toBe(won.simTimeS);
    await t.lab.handle({ type: 'reset' });
    expect(t.lab.snapshot().game).toMatchObject({ status: 'ready', best: { score: won.game.score } });
  });

  it('using Auto while playing marks the round as a test run that never records Best', async () => {
    const t = makeLab('lab01', 'manual', 1, { cfg: makeConfig({ game: { recordMinS: 10 } }) }, false);
    await t.lab.handle({ type: 'setPlcMode', mode: 'auto' });
    expect(t.lab.snapshot().game.testRun).toBe(false); // ยังไม่เริ่มเล่น
    await t.lab.handle({ type: 'startGame' });
    await t.lab.handle({ type: 'setPlcMode', mode: 'manual' });
    expect(t.lab.snapshot().game.testRun).toBe(true);
    await t.lab.handle({ type: 'setSpeed', speed: 60 });
    await runReal(t, 2000);
    expect(t.lab.snapshot().game.testRun).toBe(true);
    await t.lab.handle({ type: 'reset' });
    expect(t.lab.snapshot().game).toMatchObject({ best: null, testRun: false });
  });

  it('protocol accepts the new commands and speeds; Mock PLC defaults to manual', () => {
    for (const cmd of [{ type: 'startGame' }, { type: 'harvest' }, { type: 'setSpeed', speed: 1440 }, { type: 'setSpeed', speed: 3600 }]) {
      expect(LabCommand.safeParse(cmd).success).toBe(true);
    }
    expect(LabCommand.safeParse({ type: 'setSpeed', speed: 7200 }).success).toBe(false);
    const saved = process.env.MOCK_PLC_MODE;
    delete process.env.MOCK_PLC_MODE;
    try { expect(loadConfig().mockMode).toBe('manual'); } finally { if (saved !== undefined) process.env.MOCK_PLC_MODE = saved; }
  });
});
