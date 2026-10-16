import { describe, expect, it } from 'vitest';
import {
  envEc,
  initialEnvironment,
  levelPct,
  makeConfig,
  powerW,
  simTimeFrom,
  svpKPa,
  vpdKPa,
} from '../src';
import { OFF, flatRoomConfig, runEnv } from './helpers';

describe('Water balance', () => {
  // AC-01
  it('AC-01: water level decreases over time when refill is OFF', () => {
    const cfg = flatRoomConfig();
    const { env, history } = runEnv({ cfg, cmd: {}, hours: 24, uptakeLPerDay: 0.6 });
    const start = initialEnvironment(cfg, simTimeFrom(14, 6));

    expect(levelPct(env.waterVolumeL, cfg)).toBeLessThan(cfg.tank.initialLevelPct);
    // ลดลงต่อเนื่อง ไม่มีการเพิ่มเอง
    for (let i = 1; i < history.length; i++) {
      expect(history[i]!.waterVolumeL).toBeLessThanOrEqual(history[i - 1]!.waterVolumeL);
    }
    // Mass balance: ที่หายไป = พืชใช้ + ระเหย (ระเหยมีฝาจึงน้อยมาก)
    const lost = start.waterVolumeL - env.waterVolumeL;
    expect(env.totalUptakeL).toBeCloseTo(0.6, 3);
    expect(lost).toBeGreaterThan(0.6);
    expect(lost).toBeLessThan(0.6 + 0.2);
  });

  it('water cannot go below 0 L even with huge demand', () => {
    const cfg = flatRoomConfig();
    const { env } = runEnv({ cfg, cmd: {}, hours: 24, uptakeLPerDay: 500 });
    expect(env.waterVolumeL).toBe(0);
    expect(env.totalUptakeL).toBeLessThanOrEqual(34 + 1e-9);
  });

  // AC-02
  it('AC-02: refill pump raises the level and never exceeds 100 %', () => {
    const cfg = flatRoomConfig();
    const half = { ...initialEnvironment(cfg, simTimeFrom(14, 6)), waterVolumeL: 20, saltMass: 24 };
    const oneMin = runEnv({ cfg, cmd: { refillPump: true }, hours: 1 / 60, env: half });
    expect(oneMin.env.waterVolumeL).toBeCloseTo(22, 2); // 2 L/min
    expect(oneMin.env.refillFlowLpm).toBe(2);

    const long = runEnv({ cfg, cmd: { refillPump: true }, hours: 1, env: half });
    expect(levelPct(long.env.waterVolumeL, cfg)).toBeCloseTo(100, 6);
    expect(long.env.totalOverflowL).toBeGreaterThan(0);
    for (const s of long.history) expect(levelPct(s.waterVolumeL, cfg)).toBeLessThanOrEqual(100 + 1e-9);
  });

  it('refill flow is 0 when pump is OFF', () => {
    const { env } = runEnv({ cfg: flatRoomConfig(), cmd: { refillPump: false }, hours: 0.1 });
    expect(env.refillFlowLpm).toBe(0);
  });
});

describe('Air temperature & humidity', () => {
  it('LED heat raises air temperature toward room + ΔT_LED without jumping', () => {
    const cfg = flatRoomConfig();
    const { env, history } = runEnv({ cfg, cmd: { ledPct: 100 }, hours: 4 });
    expect(env.airTempC).toBeCloseTo(32, 1);
    for (let i = 1; i < history.length; i++) {
      expect(Math.abs(history[i]!.airTempC - history[i - 1]!.airTempC)).toBeLessThan(0.01);
    }
  });

  it('fan reduces LED heat build-up but cannot cool below room temperature', () => {
    const cfg = flatRoomConfig();
    expect(runEnv({ cfg, cmd: { ledPct: 100, fan: true }, hours: 4 }).env.airTempC).toBeCloseTo(27.8, 1);
    expect(runEnv({ cfg, cmd: { fan: true }, hours: 4 }).env.airTempC).toBeGreaterThanOrEqual(26 - 1e-6);
  });

  it('humidifier raises RH; fan reduces its effect', () => {
    const cfg = flatRoomConfig();
    expect(runEnv({ cfg, cmd: {}, hours: 3 }).env.rhPct).toBeCloseTo(65, 0);
    expect(runEnv({ cfg, cmd: { humidifier: true }, hours: 3 }).env.rhPct).toBeCloseTo(90, 0);
    expect(runEnv({ cfg, cmd: { humidifier: true, fan: true }, hours: 3 }).env.rhPct).toBeCloseTo(70, 0);
  });

  it('room temperature follows a daily cycle by default', () => {
    const cfg = makeConfig();
    const night = runEnv({ cfg, cmd: {}, hours: 6, startS: simTimeFrom(14, 0) }).env.airTempC;
    const afternoon = runEnv({ cfg, cmd: {}, hours: 6, startS: simTimeFrom(14, 9) }).env.airTempC;
    expect(afternoon).toBeGreaterThan(night);
  });

  it('water temperature lags behind air temperature', () => {
    const cfg = flatRoomConfig();
    const start = initialEnvironment(cfg, simTimeFrom(14, 6));
    const { env } = runEnv({ cfg, cmd: { ledPct: 100 }, hours: 1 });
    const airRise = env.airTempC - start.airTempC;
    const waterRise = env.waterTempC - start.waterTempC;
    expect(waterRise).toBeGreaterThan(0);
    expect(waterRise).toBeLessThan(airRise * 0.5);
  });
});

describe('VPD', () => {
  it('matches Tetens formula', () => {
    // 0.6108 · e^(17.27·25 / 262.3) = 3.1678 kPa
    expect(svpKPa(25)).toBeCloseTo(3.1678, 3);
    expect(vpdKPa(25, 60)).toBeCloseTo(1.2671, 3);
    expect(vpdKPa(25, 100)).toBe(0);
  });
});

describe('Nutrient (EC / pH)', () => {
  it('EC rises as plants draw water (salts concentrate)', () => {
    const cfg = flatRoomConfig();
    const { env } = runEnv({ cfg, cmd: {}, hours: 72, uptakeLPerDay: 2 });
    expect(envEc(env)).toBeGreaterThan(cfg.nutrient.initialEc);
  });

  it('refill dilutes EC by volume-weighted mixing with tap water', () => {
    const cfg = flatRoomConfig();
    const base = { ...initialEnvironment(cfg, simTimeFrom(14, 6)), waterVolumeL: 24, saltMass: 1.2 * 24 };
    const { env } = runEnv({ cfg, cmd: { refillPump: true }, hours: 3 / 60, env: base });
    // (1.2·24 + 0.2·6) / 30 = 1.0
    expect(envEc(env)).toBeCloseTo(1.0, 2);
  });

  it('nutrient pump A raises EC', () => {
    const cfg = flatRoomConfig();
    const { env } = runEnv({ cfg, cmd: { nutrientA: true }, hours: 10 / 60 });
    expect(envEc(env)).toBeGreaterThan(2);
  });

  it('pH drifts slowly, stays in bounds, and refill pulls it toward tap pH', () => {
    const cfg = flatRoomConfig();
    const day = runEnv({ cfg, cmd: {}, hours: 24 }).env.ph;
    expect(day).toBeCloseTo(6.1, 2);
    const base = { ...initialEnvironment(cfg, simTimeFrom(14, 6)), waterVolumeL: 20, saltMass: 24 };
    const refilled = runEnv({ cfg, cmd: { refillPump: true }, hours: 5 / 60, env: base }).env.ph;
    expect(refilled).toBeGreaterThan(6.2);
    expect(refilled).toBeLessThan(7.2);
    const extreme = runEnv({ cfg, cmd: { nutrientA: true, nutrientB: true }, hours: 24 }).env.ph;
    expect(extreme).toBeGreaterThanOrEqual(cfg.nutrient.phMin);
  });
});

describe('Power', () => {
  it('sums rated power of active actuators', () => {
    const cfg = flatRoomConfig();
    expect(powerW({ ...OFF, airPump: false }, cfg)).toBe(0);
    expect(powerW({ ...OFF, ledPct: 50, fan: true }, cfg)).toBe(60 + 15 + 5);
    const all = { fan: true, humidifier: true, ledPct: 100, refillPump: true, nutrientA: true, nutrientB: true, airPump: true };
    expect(powerW(all, cfg)).toBe(120 + 15 + 25 + 18 + 5 + 5 + 5);
  });
});
