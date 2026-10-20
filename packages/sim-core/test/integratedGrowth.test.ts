import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, SimClock, Simulation, makeConfig, stepBiomass, type SimSpeed } from '../src';
import { OFF } from './helpers';
import { plantFixture } from './plantFixture';

describe('Integrated growth / damage / recovery — P12', () => {
  it('AC-25: root and water effects do not penalize the same limitation twice', () => {
    const u = { ppfd: 250, airTempC: 24, waterStress: 0.5, lightStress: 0, nutrientStress: 0, rootHealth: 1, damage: 0 };
    const onlyWater = stepBiomass(5, u, 3600, DEFAULT_CONFIG);
    expect(stepBiomass(5, { ...u, rootHealth: 0.5 }, 3600, DEFAULT_CONFIG)).toBe(onlyWater);
    expect(stepBiomass(5, { ...u, rootHealth: 0.3 }, 3600, DEFAULT_CONFIG)).toBeLessThan(onlyWater);
  });

  it('AC-25: combined stresses reduce growth and health compared with a healthy control', () => {
    const cfg = makeConfig({ light: { ppfdMax: 650 } });
    const healthy = plantFixture(cfg, { ledPct: 250 / 650 * 100 });
    const bad = plantFixture(cfg, { ledPct: 100, ecMsCm: 0, estimatedOxygen: 0.1 });
    healthy.runHours(24);
    bad.runHours(24);
    expect(bad.plant.biomassG).toBeLessThan(healthy.plant.biomassG);
    expect(bad.plant.health).toBeLessThan(healthy.plant.health);
    expect(bad.plant.lightStress).toBeGreaterThan(0.9);
    expect(bad.plant.nutrientStress).toBeGreaterThan(0.9);
    expect(bad.plant.rootHealth).toBeLessThan(0.5);
    expect(bad.plant.damage).toBeGreaterThan(0);
    expect(bad.plant.health).toBeLessThanOrEqual(100 * (1 - bad.plant.damage));
  });

  it.each([1.5, 24])('AC-25: %s h exposure then 48 h recovery preserves permanent damage', (hours) => {
    // ไฟต่อเนื่องตลอดการทดสอบ — ปิด Photoperiod stress (P30) เพื่อแยกผลแสงแรงเกิน
    const cfg = makeConfig({ light: { ppfdMax: 650, photoperiodMaxStress: 0 } });
    const f = plantFixture(cfg, { ledPct: 100 });
    f.runHours(hours);
    const damaged = f.plant.damage;
    f.env.ledPct = 250 / 650 * 100;
    let previous = damaged;
    for (let i = 0; i < 48 * 3600; i++) {
      f.step();
      if (f.plant.damage < previous) throw new Error('Damage decreased during recovery');
      previous = f.plant.damage;
    }
    if (hours === 1.5) {
      expect(damaged).toBeLessThan(0.01);
      expect(f.plant.damage).toBeLessThan(0.01);
      expect(f.plant.health).toBeGreaterThan(99);
    } else {
      expect(damaged).toBeGreaterThan(0);
      expect(f.plant.damage).toBeGreaterThanOrEqual(damaged);
      expect(f.plant.hydration).toBeLessThan(1);
    }
    expect(f.plant.lightStress).toBeLessThan(0.001);
    expect(f.plant.health).toBeLessThanOrEqual(100 * (1 - f.plant.damage));
  });

  it('AC-26: identical command schedules at 1x/60x/360x produce identical states across tick sizes', () => {
    function run(speed: SimSpeed, ticks: number[]) {
      const sim = new Simulation({ seed: 7, cfg: makeConfig({ nutrient: { initialEc: 3 } }) });
      const clock = new SimClock({ startS: sim.startTimeS, dtS: 1, maxStepsPerTick: 5000, speed });
      const initial = sim.snapshot();
      const step = (dt: number) => {
        const elapsed = sim.simTimeS - sim.startTimeS;
        sim.step(dt, { ...OFF, ledPct: elapsed < 43200 ? 100 : 40, airPump: elapsed >= 21600 });
      };
      const totalMs = 86400 * 1000 / speed;
      let elapsed = 0;
      let index = 0;
      while (elapsed < totalMs) {
        const ms = Math.min(ticks[index++ % ticks.length]!, totalMs - elapsed);
        expect(clock.advance(ms, step).lagged).toBe(false);
        elapsed += ms;
      }
      const result = sim.snapshot();
      clock.pause();
      clock.advance(10000, step);
      expect(sim.snapshot()).toEqual(result);
      clock.resume();
      clock.advance(1000 / speed, step);
      expect(sim.simTimeS).toBe(result.simTimeS + 1);
      sim.reset();
      clock.reset();
      expect(sim.snapshot()).toEqual(initial);
      return result;
    }
    const reference = run(1, [1000]);
    expect(run(60, [100, 700, 250])).toEqual(reference);
    expect(run(360, [50, 300, 900])).toEqual(reference);
  }, 30000);
});
