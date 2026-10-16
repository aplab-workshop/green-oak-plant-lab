import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG, Simulation, makeConfig, oxygenTarget, rootSubmergedFraction, stepOxygen,
  type PlantState,
} from '../src';
import { OFF } from './helpers';

describe('Estimated Oxygen Status — P11 / AC-22', () => {
  it('falls after pump OFF and recovers after ON without instantaneous jumps', () => {
    let oxygen = 0.95;
    for (let i = 0; i < 12 * 3600; i++) {
      const next = stepOxygen(oxygen, false, 24, 85, 1, DEFAULT_CONFIG);
      expect(Math.abs(next - oxygen)).toBeLessThan(0.001);
      oxygen = next;
    }
    expect(oxygen).toBeLessThan(0.21);
    const on = stepOxygen(0.95, true, 24, 85, 12 * 3600, DEFAULT_CONFIG);
    expect(on).toBe(0.95);
    for (let i = 0; i < 6 * 3600; i++) {
      const next = stepOxygen(oxygen, true, 24, 85, 1, DEFAULT_CONFIG);
      expect(Math.abs(next - oxygen)).toBeLessThan(0.001);
      oxygen = next;
    }
    expect(oxygen).toBeGreaterThan(0.9);
  });

  it('warm and near-empty water reduce oxygen; an empty tank has target zero', () => {
    const cfg = DEFAULT_CONFIG;
    expect(stepOxygen(0.95, true, 32, 85, 12 * 3600, cfg))
      .toBeLessThan(stepOxygen(0.95, true, 24, 85, 12 * 3600, cfg));
    expect(oxygenTarget(true, 24, 1, cfg)).toBeCloseTo(0.095, 9);
    expect(oxygenTarget(true, 24, 0, cfg)).toBe(0);
    expect(oxygenTarget(true, 100, 85, cfg)).toBe(0);
    expect(oxygenTarget(true, 0, 100, cfg)).toBeLessThanOrEqual(1);
  });
});

describe('Root Health / water supply — P11', () => {
  it('AC-23: aeration changes root health and actual uptake while roots stay covered', () => {
    const cfg = makeConfig({ room: { tempMeanC: 24, tempAmplitudeC: 0 }, air: { ledHeatC: 0 } });
    const off = new Simulation({ cfg, seed: 7 });
    const on = new Simulation({ cfg, seed: 7 });
    for (let i = 0; i < 24 * 3600; i++) {
      off.step(1, { ...OFF, ledPct: 60, airPump: false });
      on.step(1, { ...OFF, ledPct: 60 });
    }
    const before = off.plants[0]!;
    expect(before.rootHealth).toBeLessThan(0.6);
    expect(before.rootSubmerged).toBe(1);
    expect(before.supplyRatio).toBeLessThan(on.plants[0]!.supplyRatio);
    expect(off.env.totalUptakeL).toBeLessThan(on.env.totalUptakeL);
    expect(off.drainEvents().some((e) => e.kind === 'tank.roots_exposed')).toBe(false);
    for (let i = 0; i < 24 * 3600; i++) off.step(1, { ...OFF, ledPct: 60 });
    expect(off.plants[0]!.rootHealth).toBeGreaterThan(0.9);
    expect(off.plants[0]!.supplyRatio).toBeGreaterThan(before.supplyRatio);
  });

  it('AC-23: Air Pump cannot replace water that does not reach the roots', () => {
    const sim = new Simulation({ cfg: makeConfig({ tank: { initialLevelPct: 30 } }) });
    for (let i = 0; i < 3600; i++) sim.step(1, { ...OFF, ledPct: 60, airPump: true });
    expect(sim.env.estimatedOxygen).toBeGreaterThan(0.6);
    for (const p of sim.plants) {
      expect(p.rootSubmerged).toBe(0);
      expect(p.supplyRatio).toBe(0);
      expect(p.rootHealth).toBeLessThan(1);
      expect(p.hydration).toBeLessThan(1);
    }
    expect(sim.env.totalUptakeL).toBe(0);
  });

  it('AC-24: long roots do not gain imaginary access below the tank floor', () => {
    const cfg = DEFAULT_CONFIG;
    expect(rootSubmergedFraction(0, 20, cfg)).toBe(0);
    expect(rootSubmergedFraction(0.2, 20, cfg)).toBeCloseTo(0.2 / 15, 9);
    expect(rootSubmergedFraction(10, 12, cfg)).toBeGreaterThan(rootSubmergedFraction(10, 6, cfg));
  });

  it.each([0, 1])('AC-24: %i%% water stays finite and supplied uptake matches water removed', (initialLevelPct) => {
    const cfg = makeConfig({
      tank: { initialLevelPct, capacityL: 0.001 },
      plant: { initialBiomassG: 100, initialBiomassSpread: 0, transpirationLPerM2Day: 1e6 },
    });
    const sim = new Simulation({ cfg });
    const available = sim.env.waterVolumeL;
    const initial = sim.snapshot();
    for (let i = 0; i < 60; i++) {
      const before = sim.env.totalUptakeL;
      sim.step(1, { ...OFF, ledPct: 100 });
      const delivered = sim.plants.reduce((sum, p) => sum + p.demandLPerDay * p.supplyRatio / 86400, 0);
      expect(sim.env.totalUptakeL - before).toBeCloseTo(delivered, 12);
      expect(sim.env.waterVolumeL).toBeGreaterThanOrEqual(0);
      for (const value of Object.values(sim.env)) expect(Number.isFinite(value)).toBe(true);
      expect(sim.env.estimatedOxygen).toBeGreaterThanOrEqual(0);
      expect(sim.env.estimatedOxygen).toBeLessThanOrEqual(1);
      sim.plants.forEach((p: Readonly<PlantState>) => {
        for (const value of Object.values(p)) if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
        for (const value of [p.rootHealth, p.supplyRatio, p.hydration, p.lightStress, p.nutrientStress]) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      });
    }
    expect(sim.env.totalUptakeL).toBeLessThanOrEqual(available + 1e-9);
    expect(sim.env.waterVolumeL).toBe(0);
    sim.reset();
    expect(sim.snapshot()).toEqual(initial);
  });

  it('AC-24: refilling an empty tank restores access while oxygen and root health recover gradually', () => {
    const sim = new Simulation({ cfg: makeConfig({ tank: { initialLevelPct: 0 } }) });
    for (let i = 0; i < 12 * 3600; i++) sim.step(1, OFF);
    const dry = sim.plants[0]!.rootHealth;
    expect(sim.env.estimatedOxygen).toBe(0);
    for (let i = 0; i < 18 * 60; i++) sim.step(1, { ...OFF, refillPump: true });
    expect(sim.env.waterVolumeL).toBeGreaterThan(30);
    expect(sim.env.estimatedOxygen).toBeLessThan(0.2);
    for (let i = 0; i < 24 * 3600; i++) sim.step(1, OFF);
    expect(sim.env.estimatedOxygen).toBeGreaterThan(0.6);
    expect(sim.plants[0]!.rootHealth).toBeGreaterThan(dry);
    expect(sim.env.totalUptakeL).toBeLessThanOrEqual(sim.env.totalRefillL + 1e-9);
  });
});
