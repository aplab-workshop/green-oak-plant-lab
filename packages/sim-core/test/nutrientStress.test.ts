import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG, Simulation, envEc, hourOfDay, levelPct, makeConfig,
  nutrientStressTarget, stepPh, stepSalt,
} from '../src';
import { OFF, noSunConfig } from './helpers';
import { plantFixture } from './plantFixture';

describe('Nutrient Stress — P10', () => {
  it.each([
    { ecMsCm: 0, ph: 6 }, { ecMsCm: 3.2, ph: 6 },
    { ecMsCm: 1.2, ph: 4 }, { ecMsCm: 1.2, ph: 9 },
  ])('AC-19: accumulates, limits growth and recovers for %j', (env) => {
    const bad = plantFixture(DEFAULT_CONFIG, env);
    const healthy = plantFixture(DEFAULT_CONFIG);
    bad.step();
    expect(bad.plant.nutrientStress).toBeLessThan(0.001);
    bad.runHours(24 - 1 / 3600);
    healthy.runHours(24);
    expect(bad.plant.nutrientStress).toBeGreaterThan(0.95);
    expect(healthy.plant.nutrientStress).toBe(0);
    expect(bad.plant.biomassG).toBeLessThan(healthy.plant.biomassG);
    bad.env.ecMsCm = 1.2;
    bad.env.ph = 6;
    const before = bad.plant.nutrientStress;
    bad.step();
    expect(bad.plant.nutrientStress).toBeGreaterThan(before - 0.001);
    bad.runHours(48 - 1 / 3600);
    expect(bad.plant.nutrientStress).toBeLessThan(0.02);
  });

  it('uses the limiting factor with gradual shoulders and bounded extremes', () => {
    expect(nutrientStressTarget(0.4, 6, DEFAULT_CONFIG)).toBeCloseTo(0.5);
    expect(nutrientStressTarget(2.4, 6, DEFAULT_CONFIG)).toBeCloseTo(0.5);
    expect(nutrientStressTarget(1.2, 4.75, DEFAULT_CONFIG)).toBeCloseTo(0.5);
    expect(nutrientStressTarget(1.2, 7.9, DEFAULT_CONFIG)).toBeCloseTo(0.5);
    expect(nutrientStressTarget(0.4, 4.75, DEFAULT_CONFIG)).toBeCloseTo(0.5);
    expect(nutrientStressTarget(100, 0, DEFAULT_CONFIG)).toBe(1);
    expect(nutrientStressTarget(0.8, 5.5, DEFAULT_CONFIG)).toBe(0);
    expect(nutrientStressTarget(1.6, 6.8, DEFAULT_CONFIG)).toBe(0);
  });

  it.each([{ initialEc: 0 }, { initialPh: 9 }])('AC-21: Simulation passes actual environment into plants (%j)', (initial) => {
    const sim = new Simulation({ seed: 7, cfg: makeConfig({ nutrient: initial }) });
    const healthy = new Simulation({ seed: 7 });
    for (let i = 0; i < 86400; i++) {
      const cmd = { ...OFF, ledPct: 60, fanPct: 100 };
      sim.step(1, cmd);
      healthy.step(1, cmd);
      // ค่า Sensor ที่อ่านไม่ควรมีผลต่อการคำนวณ Plant
      if (i % 600 === 0) sim.readSensors(true);
    }
    expect(sim.plants[0]!.nutrientStress).toBeGreaterThan(healthy.plants[0]!.nutrientStress + 0.3);
    expect(sim.plants[0]!.biomassG).toBeLessThan(healthy.plants[0]!.biomassG);
    if (initial.initialEc === 0) expect(sim.env.saltMass).toBe(0);
  }, 30_000);

  it('AC-21: sensor noise consumption cannot change model state', () => {
    const a = new Simulation({ seed: 7, cfg: makeConfig({ nutrient: { initialEc: 3 } }) });
    const b = new Simulation({ seed: 7, cfg: a.cfg });
    for (let i = 0; i < 3600; i++) {
      a.readSensors();
      a.step(1, OFF);
      b.step(1, OFF);
    }
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('AC-21: salt mass changes only by configured incoming/outgoing flows', () => {
    expect(stepSalt(24, { volumeBeforeL: 20, refillInL: 0, doseAL: 0, doseBL: 0, uptakeL: 0, drainL: 0 }, DEFAULT_CONFIG)).toBe(24);
    const actual = stepSalt(24, { volumeBeforeL: 20, refillInL: 2, doseAL: 0.05, doseBL: 0.05, uptakeL: 0.1, drainL: 1 }, DEFAULT_CONFIG);
    expect(actual).toBeCloseTo(24 + 0.4 + 10 - 0.8 * 0.1 * 1.2 - 1.2, 9);
  });
});

describe('Empirical pH equilibrium — P10 / AC-20', () => {
  const noFlows = { volumeBeforeL: 34, refillInL: 0, doseMinutes: 0 };

  it('converges without clamp saturation for 30 days from either side', () => {
    for (const initial of [4, 6, 9]) {
      let ph = initial;
      for (let i = 0; i < 30 * 86400; i++) {
        ph = stepPh(ph, noFlows, 1, DEFAULT_CONFIG);
        if (initial === 6 && i === 86399) expect(ph).toBeCloseTo(6.0786939, 6);
      }
      expect(ph).toBeCloseTo(6.2, 5); // เริ่มจาก 9 เหลือความคลาด 8.6e-7
      expect(Math.abs(ph - 6.2)).toBeLessThan(1e-6);
    }
  });

  it('retains refill mixing and empirical dosing effects within bounds', () => {
    const cfg = DEFAULT_CONFIG;
    const relaxed = stepPh(6, noFlows, 60, cfg);
    expect(stepPh(6, { volumeBeforeL: 20, refillInL: 10, doseMinutes: 0 }, 60, cfg))
      .toBeCloseTo((relaxed * 20 + 7.2 * 10) / 30, 9);
    expect(stepPh(6, { ...noFlows, doseMinutes: 2 }, 60, cfg)).toBeCloseTo(relaxed - 0.04, 9);
    expect(stepPh(6, { ...noFlows, doseMinutes: 10000 }, 60, cfg)).toBe(4);
    expect(stepPh(6, { volumeBeforeL: 0, refillInL: 2, doseMinutes: 0 }, 60, cfg)).toBe(7.2);
  });

  it('AC-20 / AC-25: healthy plants grow within bounds during a managed 30-day Simulation', () => {
    // ไฟ LED คงที่ 06–22 ตามสูตรเดิม — ปิดแดด (P36) เพื่อแยกผล pH/EC
    const sim = new Simulation({ seed: 7, cfg: noSunConfig() });
    let minimum = sim.env.ph;
    let maximum = sim.env.ph;
    for (let i = 0; i < 30 * 86400; i++) {
      const h = hourOfDay(sim.simTimeS);
      const dose = envEc(sim.env) < 1;
      sim.step(1, { ...OFF, ledPct: h >= 6 && h < 22 ? 80 : 0,
        refillPump: levelPct(sim.env.waterVolumeL, sim.cfg) < 70,
        fanPct: sim.env.airTempC > 25 ? 100 : 0, nutrientA: dose, nutrientB: dose });
      minimum = Math.min(minimum, sim.env.ph);
      maximum = Math.max(maximum, sim.env.ph);
      if (i % 86400 === 0) sim.drainEvents();
    }
    expect(minimum).toBeGreaterThanOrEqual(5.5);
    expect(maximum).toBeLessThanOrEqual(6.8);
    const avgBiomass = sim.plants.reduce((sum, p) => sum + p.biomassG, 0) / sim.plants.length;
    expect(avgBiomass).toBeGreaterThanOrEqual(70);
    expect(avgBiomass).toBeLessThanOrEqual(150);
    for (const p of sim.plants) {
      expect(p.damage).toBeLessThan(0.01);
      expect(p.health).toBeLessThanOrEqual(100 * (1 - p.damage));
    }
    // 2.6 ล้าน Step — ขณะรันพร้อมเทสต์อื่นเกิน 60 s ได้ (พบ 68 s ใน P38)
  }, 180000);
});
