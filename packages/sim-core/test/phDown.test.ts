import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, Simulation, initialEnvironment, powerW, simTimeFrom } from '../src';
import { OFF, flatRoomConfig, runEnv } from './helpers';

describe('pH Down Pump M106 — P22 / SPEC § 4.7', () => {
  it('one 2-minute dose lowers pH by ≈0.2 at the initial 85 % level', () => {
    const cfg = flatRoomConfig();
    const start = initialEnvironment(cfg, simTimeFrom(14, 6));
    const dosed = runEnv({ cfg, cmd: { phDown: true }, hours: cfg.dose.phDownS / 3600 }).env;
    const control = runEnv({ cfg, cmd: {}, hours: cfg.dose.phDownS / 3600 }).env;
    expect(cfg.dose.phDownS).toBe(120);
    expect(control.ph - dosed.ph).toBeCloseTo(0.2, 3);
    expect(dosed.ph).toBeLessThan(start.ph);
  });

  it('acts stronger in less water (scaled by reference volume)', () => {
    const cfg = flatRoomConfig();
    const base = initialEnvironment(cfg, simTimeFrom(14, 6));
    const half = { ...base, waterVolumeL: base.waterVolumeL / 2, saltMass: base.saltMass / 2 };
    const dosed = runEnv({ cfg, cmd: { phDown: true }, hours: 120 / 3600, env: half }).env;
    const control = runEnv({ cfg, cmd: {}, hours: 120 / 3600, env: half }).env;
    expect(control.ph - dosed.ph).toBeCloseTo(0.4, 3);
  });

  it('never goes below phMin and does not change EC or water volume', () => {
    const cfg = flatRoomConfig();
    const long = runEnv({ cfg, cmd: { phDown: true }, hours: 24 }).env;
    const control = runEnv({ cfg, cmd: {}, hours: 24 }).env;
    expect(long.ph).toBe(cfg.nutrient.phMin);
    expect(long.waterVolumeL).toBeCloseTo(control.waterVolumeL, 9);
    expect(long.saltMass).toBeCloseTo(control.saltMass, 9);
  });

  it('adds its rated power', () => {
    expect(powerW({ ...OFF, airPump: false, phDown: true }, DEFAULT_CONFIG)).toBe(DEFAULT_CONFIG.power.phDownPumpW);
  });

  it('setPh sets and clamps the solution pH', () => {
    const sim = new Simulation();
    sim.setPh(7.4);
    expect(sim.env.ph).toBe(7.4);
    sim.setPh(20);
    expect(sim.env.ph).toBe(sim.cfg.nutrient.phMax);
  });
});
