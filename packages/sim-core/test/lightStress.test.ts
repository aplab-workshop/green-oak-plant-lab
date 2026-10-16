import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, Simulation, hourOfDay, makeConfig, stepLightStress } from '../src';
import { OFF } from './helpers';
import { plantFixture } from './plantFixture';

describe('Light Stress / Low Light — P9', () => {
  it('AC-16: accumulates over hours, keeps a hydrated plant upright, and recovers gradually', () => {
    const f = plantFixture(makeConfig({ light: { ppfdMax: 650 } }), { ledPct: 100 });
    f.step();
    expect(f.plant.lightStress).toBeGreaterThan(0);
    expect(f.plant.lightStress).toBeLessThan(0.001);
    expect(f.plant.hydration).toBe(1);
    expect(f.plant.waterStress).toBe(0);
    f.runHours(6);
    expect(f.plant.lightStress).toBeGreaterThan(0.9);
    expect(f.plant.hydration).toBe(1);
    const stressed = f.plant.lightStress;
    f.env.ledPct = 100 * 250 / 650;
    f.step();
    expect(f.plant.lightStress).toBeGreaterThan(stressed - 0.001);
    f.runHours(12);
    expect(f.plant.lightStress).toBeLessThan(0.05);
  });

  it('AC-17: heat and dehydration amplify the same exposure, darkness never creates it', () => {
    const cfg = DEFAULT_CONFIG;
    const normal = stepLightStress(0, 400, 24, 1, 7200, cfg);
    expect(stepLightStress(0, 400, 32, 1, 7200, cfg)).toBeGreaterThan(normal);
    expect(stepLightStress(0, 400, 24, 0.4, 7200, cfg)).toBeGreaterThan(normal);
    expect(stepLightStress(0, 0, 40, 0, 7200, cfg)).toBe(0);
    expect(stepLightStress(0, 10000, 60, 0, 86400, cfg)).toBeLessThanOrEqual(1);
  });

  it('AC-17: centre and corner exposures use their own PPFD in Simulation', () => {
    const sim = new Simulation();
    for (let i = 0; i < 7200; i++) sim.step(1, { ...OFF, ledPct: 100 });
    expect(sim.plants[1]!.lightStress).toBeGreaterThan(sim.plants[0]!.lightStress);
    expect(sim.plants[0]!.lightStress).toBe(0); // 340 PPFD < 350
  });

  it('AC-17: low light reduces growth with identical water and air temperature', () => {
    const dim = plantFixture(DEFAULT_CONFIG, { ledPct: 12.5 }); // 50 PPFD
    const lit = plantFixture(DEFAULT_CONFIG); // 250 PPFD
    dim.runHours(72);
    lit.runHours(72);
    expect(dim.plant.biomassG).toBeLessThan(lit.plant.biomassG * 0.8);
    expect(dim.plant.lightStress).toBe(0);
    expect(dim.plant.waterStress).toBe(0);
    expect(dim.plant.damage).toBe(0);
  });

  it('AC-18: a normal 3-day photoperiod causes no light stress or damage', () => {
    const f = plantFixture(DEFAULT_CONFIG);
    for (let i = 0; i < 3 * 86400; i++) {
      const h = hourOfDay(f.env.simTimeS);
      f.env.ledPct = h >= 6 && h < 22 ? 62.5 : 0;
      f.step();
    }
    expect(f.plant.damage).toBe(0);
    expect(f.plant.lightStress).toBe(0);
    expect(f.plant.dliYesterday).toBeCloseTo(14.4, 6);
    const biomass = f.plant.biomassG;
    const dli = f.plant.dliToday;
    f.env.ledPct = 0;
    f.runHours(8);
    expect(f.plant.biomassG).toBe(biomass);
    expect(f.plant.dliToday).toBe(dli);
  });

  it('AC-18: midnight rolls DLI over without erasing stress memory', () => {
    const f = plantFixture(makeConfig({ light: { ppfdMax: 650 } }), { ledPct: 100 });
    f.runHours(18 - 1 / 3600);
    const before = f.plant;
    f.step();
    expect(f.plant.dliToday).toBe(0);
    expect(f.plant.dliYesterday).toBeCloseTo(before.dliToday + 650 / 1e6, 9);
    expect(f.plant.lightStress).toBeGreaterThanOrEqual(before.lightStress);
    expect(f.plant.lightStress).toBeLessThanOrEqual(1);
  });
});
