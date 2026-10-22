import { describe, expect, it } from 'vitest';
import { SENSOR_REGISTERS, toRaw } from '@gol/shared';
import { Rng, initialEnvironment, readSensors, readSimInfo, simTimeFrom } from '../src';
import { flatRoomConfig, runEnv } from './helpers';

describe('readSensors', () => {
  it('without RNG returns exact model values', () => {
    const cfg = flatRoomConfig();
    const env = initialEnvironment(cfg, simTimeFrom(14, 6));
    const r = readSensors(env, cfg);
    expect(r.waterLevelPct).toBeCloseTo(85, 9);
    expect(r.ecMsCm).toBeCloseTo(1.2, 9);
    expect(r.ph).toBe(6);
    expect(r.airTempC).toBe(env.airTempC);
  });

  it('noise is small, deterministic per seed and does not change model state', () => {
    const cfg = flatRoomConfig();
    const env = runEnv({ cfg, cmd: { ledPct: 80 }, hours: 1 }).env;
    const snapshot = JSON.stringify(env);
    const a = readSensors(env, cfg, new Rng(5));
    const b = readSensors(env, cfg, new Rng(5));
    expect(a).toEqual(b);
    expect(Math.abs(a.airTempC - env.airTempC)).toBeLessThan(1);
    expect(Math.abs(a.ppfd - env.ppfd)).toBeLessThan(20);
    expect(JSON.stringify(env)).toBe(snapshot);
  });

  it('every reading fits its PLC register without clamping in normal operation', () => {
    const cfg = flatRoomConfig();
    const env = runEnv({ cfg, cmd: { ledPct: 100, fanPct: 100, humidifier: true }, hours: 10 }).env;
    const r = readSensors(env, cfg, new Rng(1));
    for (const reg of SENSOR_REGISTERS) {
      expect(toRaw(reg, r[reg.key]).clamped, reg.key).toBe(false);
    }
  });

  it('readSimInfo gives D111 minute-of-day and D112 day', () => {
    expect(readSimInfo(simTimeFrom(20, 22, 15))).toEqual({ minuteOfDay: 22 * 60 + 15, day: 20 });
  });
});
