import { describe, expect, it } from 'vitest';
import type { ActuatorCommands } from '@gol/shared';
import { DEFAULT_CONFIG, Simulation, hourOfDay, levelPct, makeConfig } from '../src';
import { combinedStress } from '../src/plant/stress';
import { OFF } from './helpers';
import { plantFixture } from './plantFixture';

/** P33 / SPEC § 4.16 — Air (VPD) stress: ลด Growth อย่างเดียว ฟื้นได้ ไม่หักซ้ำ */

type CmdFn = (sim: Simulation) => Partial<ActuatorCommands>;
const run = (sim: Simulation, hours: number, cmd: CmdFn, dtS = 10) => {
  for (let i = 0; i < (hours * 3600) / dtS; i++) sim.step(dtS, { ...OFF, ...cmd(sim) });
};
const recipe = (s: Simulation): Partial<ActuatorCommands> => ({
  ledPct: hourOfDay(s.simTimeS) >= 6 && hourOfDay(s.simTimeS) < 22 ? 80 : 0,
  refillPump: levelPct(s.env.waterVolumeL, s.cfg) < 70,
  fanPct: s.env.airTempC > 25.5 ? 100 : 0,
});
const avg = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const dryOf = (s: Simulation) => avg(s.plants.map((p) => p.dryAirStress));
const humidOf = (s: Simulation) => avg(s.plants.map((p) => p.humidAirStress));
const mass = (s: Simulation) => avg(s.plants.map((p) => p.biomassG));

describe('Air (VPD) stress — P33', () => {
  it('(1) very dry air slows growth even with plenty of water, and builds up gradually', () => {
    const dry = plantFixture(DEFAULT_CONFIG, { vpdKPa: 2.6 });
    const ok = plantFixture(DEFAULT_CONFIG, { vpdKPa: 1.0 });
    dry.runHours(0.25);
    expect(dry.plant.dryAirStress).toBeGreaterThan(0);
    expect(dry.plant.dryAirStress).toBeLessThan(0.05); // ไม่กระโดดทันที
    for (let i = 0; i < 48 * 360; i++) { dry.step(10); ok.step(10); }
    expect(dry.plant.dryAirStress).toBeGreaterThan(0.45);
    expect(dry.plant.dryAirStress).toBeLessThanOrEqual(DEFAULT_CONFIG.airStress.maxStress + 1e-9);
    expect(dry.plant.hydration).toBeGreaterThan(0.95); // น้ำพอ
    expect(dry.plant.biomassG).toBeLessThan(ok.plant.biomassG);
    expect(ok.plant.dryAirStress).toBe(0);
    expect(ok.plant.humidAirStress).toBe(0);
  });

  it('(2) a humidifier in a dry room brings VPD back and the stress recovers', () => {
    // ห้องแห้ง 35 % (ใกล้เหตุการณ์อากาศแห้ง 60 − 20 %)
    const cfg = makeConfig({ room: { tempMeanC: 24, tempAmplitudeC: 0, rhPct: 35 } });
    const s = new Simulation({ seed: 5, cfg }), off = new Simulation({ seed: 5, cfg });
    run(s, 24, recipe);
    run(off, 24, recipe);
    const stressed = dryOf(s); // วัดตอน 06:00 หลังกลางคืนฟื้นไปบางส่วน
    expect(stressed).toBeGreaterThan(0.1);
    run(s, 24, (x) => ({ ...recipe(x), humidifier: true }));
    run(off, 24, recipe);
    expect(s.readSensors(false).vpdKPa).toBeLessThan(off.readSensors(false).vpdKPa - 0.5);
    expect(dryOf(s)).toBeLessThan(stressed / 2);
    expect(dryOf(off)).toBeGreaterThan(stressed * 0.8);
    expect(mass(s)).toBeGreaterThan(mass(off));
  });

  it('(3) humidifier left on makes the night air too humid; switching it off recovers', () => {
    const cfg = makeConfig({ room: { tempMeanC: 24, tempAmplitudeC: 0 } });
    const stuck = new Simulation({ seed: 5, cfg }), normal = new Simulation({ seed: 5, cfg });
    run(stuck, 48, (x) => ({ ...recipe(x), humidifier: true }));
    run(normal, 48, recipe);
    expect(humidOf(stuck)).toBeGreaterThan(0.1); // วัดตอน 06:00 หลังคืนที่ชื้นจัด
    expect(humidOf(normal)).toBe(0);
    expect(mass(stuck)).toBeLessThan(mass(normal));
    const peak = humidOf(stuck);
    run(stuck, 24, recipe);
    expect(humidOf(stuck)).toBeLessThan(peak / 5);
  });

  it('(4) good conditions create no air stress, and air stress alone never causes damage', () => {
    const s = new Simulation({ seed: 5 });
    run(s, 72, recipe);
    expect(dryOf(s)).toBe(0);
    expect(humidOf(s)).toBe(0);
    const extreme = plantFixture(DEFAULT_CONFIG, { vpdKPa: 0.05 });
    for (let i = 0; i < 5 * 8640; i++) extreme.step(10);
    expect(extreme.plant.humidAirStress).toBeCloseTo(DEFAULT_CONFIG.airStress.maxStress, 3);
    expect(extreme.plant.damage).toBe(0);
  });

  it('(5) results do not depend on tick size', () => {
    const a = plantFixture(DEFAULT_CONFIG, { vpdKPa: 2.2 });
    const b = plantFixture(DEFAULT_CONFIG, { vpdKPa: 2.2 });
    for (let i = 0; i < 6 * 3600; i++) a.step(1);
    for (let i = 0; i < 6 * 60; i++) b.step(60);
    expect(b.plant.dryAirStress).toBeCloseTo(a.plant.dryAirStress, 3);
    expect(b.plant.biomassG).toBeCloseTo(a.plant.biomassG, 3);
  });

  it('dry air shares the water group and humid air the nutrient group (no double counting)', () => {
    expect(combinedStress(0.5, 0, 0, 1, 0.4, 0).growthFactor).toBe(combinedStress(0.5, 0, 0, 1).growthFactor);
    expect(combinedStress(0, 0, 0.5, 1, 0, 0.3).growthFactor).toBe(combinedStress(0, 0, 0.5, 1).growthFactor);
    expect(combinedStress(0, 0, 0, 1, 0.4, 0).growthFactor).toBeCloseTo(0.6, 12);
    expect(combinedStress(0, 0, 0, 1, 0, 0.4).maximum).toBeCloseTo(0.4, 12);
  });
});
