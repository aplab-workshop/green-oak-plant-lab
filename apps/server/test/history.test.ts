import { describe, expect, it } from 'vitest';
import { Simulation, makeConfig } from '@gol/sim-core';
import { History } from '../src/lab/History';
import { EventLog } from '../src/lab/EventLog';
import { makeLab, runReal } from './helpers';
import { FAILSAFE_COMMANDS } from '../src/plc/failsafe';

describe('M2 data contract — P13 / AC-27', () => {
  it('snapshots and sampled plant data agree, pause freezes history, reset starts a new run', async () => {
    const t = makeLab('lab01', 'manual', 7);
    await t.lab.handle({ type: 'setSpeed', speed: 60 });
    await t.lab.handle({ type: 'setManualBit', key: 'airPump', value: false });
    await runReal(t, 10000);
    const snapshot = t.lab.snapshot();
    const samples = t.lab.history.list();
    expect(samples).toHaveLength(2);
    const last = samples.at(-1)!;
    expect(last.simTimeS).toBe(snapshot.simTimeS);
    expect(last.estimatedOxygen).toBe(snapshot.tank.estimatedOxygen);
    expect(last.estimatedOxygen).toBe(t.lab.sim.env.estimatedOxygen);
    for (const p of last.plants) expect(snapshot.plants.find((x) => x.id === p.id)).toMatchObject(p);
    // คำตอบเป็นสำเนาลึก ไม่ให้ consumer แก้ประวัติได้
    last.plants[0]!.health = -1;
    expect(t.lab.history.list().at(-1)!.plants[0]!.health).toBeGreaterThanOrEqual(0);
    await t.lab.handle({ type: 'pause' });
    const before = t.lab.history.list();
    const state = t.lab.sim.snapshot();
    await runReal(t, 10000);
    expect(t.lab.history.list()).toEqual(before);
    expect(t.lab.sim.snapshot()).toEqual(state);
    t.lab.reset();
    expect(t.lab.snapshot().runId).toBe(snapshot.runId + 1);
    expect(t.lab.history.list()).toHaveLength(1);
    expect(t.lab.history.list()[0]!.simTimeS).toBe(t.lab.sim.startTimeS);
    expect(t.lab.events.list()).toHaveLength(1);
    expect(t.lab.events.list()[0]).toMatchObject({ runId: snapshot.runId + 1, kind: 'lab.reset' });
  });

  it('keeps labs isolated through 24 hours of different commands and a reset', async () => {
    const a = makeLab('lab01', 'manual', 7);
    const b = makeLab('lab02', 'auto', 8);
    const control = makeLab('lab02', 'auto', 8);
    for (const t of [a, b, control]) await t.lab.handle({ type: 'setSpeed', speed: 360 });
    await a.lab.handle({ type: 'setManualBit', key: 'airPump', value: false });
    for (const t of [a, b, control]) await runReal(t, 240000);
    expect(a.lab.snapshot().tank.estimatedOxygen).toBeLessThan(b.lab.snapshot().tank.estimatedOxygen);
    a.lab.reset();
    expect(b.lab.history.list()).toEqual(control.lab.history.list());
    expect(b.lab.snapshot().plants).toEqual(control.lab.snapshot().plants);
    expect(b.lab.snapshot().runId).toBe(0);
  }, 30000);

  it('caps a 15-day history at 2016 samples exactly 600 s apart', () => {
    const sim = new Simulation({ cfg: makeConfig({ plant: { count: 1 } }) });
    const history = new History();
    history.maybeSample(sim);
    for (let i = 0; i < 15 * 86400; i++) {
      sim.step(1, FAILSAFE_COMMANDS);
      history.maybeSample(sim);
      if (i % 86400 === 0) sim.drainEvents();
    }
    const samples = history.list();
    expect(samples).toHaveLength(2016);
    expect(samples.at(-1)!.simTimeS).toBe(sim.simTimeS);
    for (let i = 1; i < samples.length; i++) expect(samples[i]!.simTimeS - samples[i - 1]!.simTimeS).toBe(600);
  }, 30000);

  it('caps event memory at 1000 and marks a fresh run after clearing', () => {
    const events = new EventLog();
    for (let i = 0; i < 1005; i++) events.add({ at: 0, simTimeS: i, kind: 'test', severity: 'info', message: String(i) });
    expect(events.list()).toHaveLength(1000);
    expect(events.list()[0]!.id).toBe(6);
    events.clear();
    expect(events.list()).toEqual([]);
    expect(events.add({ at: 0, simTimeS: 0, kind: 'lab.reset', severity: 'info', message: 'Reset' }).runId).toBe(1);
  });
});
