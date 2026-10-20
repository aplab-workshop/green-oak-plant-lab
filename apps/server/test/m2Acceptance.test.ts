import { describe, expect, it } from 'vitest';
import { makeConfig } from '@gol/sim-core';
import { makeLab, runReal, type TestLab } from './helpers';

// เดินวงจร tick/poll จริงด้วย FakeClock: 1 h จำลอง = 10 s ที่ 360x
async function hours(t: TestLab, h: number) {
  await t.lab.handle({ type: 'setSpeed', speed: 360 });
  await t.lab.poll();
  await runReal(t, h * 10000);
  const snapshot = t.lab.snapshot();
  const last = t.lab.history.list().at(-1)!;
  expect(last.simTimeS).toBe(snapshot.simTimeS);
  expect(last.estimatedOxygen).toBe(snapshot.tank.estimatedOxygen);
  last.plants.forEach((p) => expect(snapshot.plants.find((x) => x.id === p.id)).toMatchObject(p));
  expect(snapshot.failsafe).toBe(false);
  return snapshot;
}

describe('M2 classroom acceptance through PLC, simulation, history and events — P15', () => {
  it('high light command accumulates stress, reduced light clears it, damage remains', async () => {
    // ไฟต่อเนื่อง 24 ชม. — ปิด Photoperiod stress (P30) เพื่อแยกผลแสงแรงเกิน
    const t = makeLab('lab01', 'manual', 7, { cfg: makeConfig({ light: { ppfdMax: 650, photoperiodMaxStress: 0 },
      room: { tempMeanC: 24, tempAmplitudeC: 0 }, air: { ledHeatC: 0 } }) });
    await t.lab.handle({ type: 'setManualLed', value: 100 });
    const exposed = await hours(t, 6);
    expect(exposed.plants[1]!.lightStress).toBeGreaterThan(0.9);
    expect(t.lab.events.list().filter((e) => e.kind === 'plant.light_stress' && e.plantId === 2)).toHaveLength(1);
    await t.lab.handle({ type: 'setManualLed', value: 35 });
    const recovered = await hours(t, 18);
    expect(recovered.plants[1]!.lightStress).toBeLessThan(0.05);
    expect(recovered.plants[1]!.damage).toBeGreaterThanOrEqual(exposed.plants[1]!.damage);
    expect(t.lab.events.list().filter((e) => e.kind === 'plant.light_stress_cleared' && e.plantId === 2)).toHaveLength(1);
  });

  it.each([{ initialEc: 0 }, { initialEc: 3.2 }, { initialPh: 4 }, { initialPh: 9 }])
   ('initial nutrient condition %j reaches plant diagnostics, history and event log', async (nutrient) => {
      const t = makeLab('lab01', 'manual', 7, { cfg: makeConfig({ nutrient }) });
      await t.lab.handle({ type: 'setManualLed', value: 60 });
      const result = await hours(t, 6);
      expect(result.plants.every((p) => p.nutrientStress > 0.3)).toBe(true);
      expect(t.lab.events.list().filter((e) => e.kind === 'plant.nutrient_stress')).toHaveLength(6);
    });

  it('Air Pump OFF/ON produces root stress and recovery while roots remain underwater', async () => {
    const t = makeLab('lab01', 'manual', 7, { cfg: makeConfig({
      room: { tempMeanC: 24, tempAmplitudeC: 0 }, air: { ledHeatC: 0 },
    }) });
    await t.lab.handle({ type: 'setManualLed', value: 60 });
    await t.lab.handle({ type: 'setManualBit', key: 'airPump', value: false });
    const off = await hours(t, 24);
    expect(off.tank.estimatedOxygen).toBeLessThan(0.21);
    expect(off.plants[0]!.rootHealth).toBeLessThan(0.6);
    expect(off.plants[0]!.rootSubmerged).toBe(1);
    expect(t.lab.events.list().filter((e) => e.kind === 'plant.root_stress')).toHaveLength(6);
    await t.lab.handle({ type: 'setManualBit', key: 'airPump', value: true });
    const on = await hours(t, 24);
    expect(on.tank.estimatedOxygen).toBeGreaterThan(0.9);
    expect(on.plants[0]!.rootHealth).toBeGreaterThan(0.9);
    expect(t.lab.events.list().filter((e) => e.kind === 'plant.root_stress_cleared')).toHaveLength(6);
  });
});
