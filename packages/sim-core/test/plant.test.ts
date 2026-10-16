import { describe, expect, it } from 'vitest';
import type { ActuatorCommands } from '@gol/shared';
import {
  DEFAULT_CONFIG,
  Simulation,
  hourOfDay,
  hydrationCap,
  levelPct,
  lightFactor,
  morphology,
  rootSubmergedFraction,
  rootSupplyRatio,
  temperatureFactor,
  type PlantState,
  type SimEvent,
} from '../src';
import { OFF } from './helpers';

const cfg = DEFAULT_CONFIG;
type CmdFn = (sim: Simulation) => Partial<ActuatorCommands>;

/** เดิน Simulation ตามเวลาที่กำหนด คืนประวัติของต้นที่ index */
function run(sim: Simulation, hours: number, cmd: Partial<ActuatorCommands> | CmdFn, dtS = 1) {
  const steps = Math.round((hours * 3600) / dtS);
  const history: PlantState[][] = [];
  const events: SimEvent[] = [];
  for (let i = 0; i < steps; i++) {
    const c = typeof cmd === 'function' ? cmd(sim) : cmd;
    sim.step(dtS, { ...OFF, ...c });
    if (i % 60 === 0) history.push(sim.plants.map((p) => ({ ...p })));
    events.push(...sim.drainEvents());
  }
  return { history, events };
}

/** ตัวอย่าง Logic แบบ Ladder: Photoperiod 06–22, Refill เมื่อ < 70 %, Fan เมื่อ > 25 °C */
const goodCare =
  (led = 80): CmdFn =>
  (sim) => {
    const h = hourOfDay(sim.simTimeS);
    const level = levelPct(sim.env.waterVolumeL, sim.cfg);
    return { ledPct: h >= 6 && h < 22 ? led : 0, refillPump: level < 70, fan: sim.env.airTempC > 25 };
  };

const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

describe('Root water access (FR-22)', () => {
  it('fraction of roots under water depends on water height and root length', () => {
    // ก้น Net Pot อยู่ที่ 15 cm
    expect(rootSubmergedFraction(16, 5, cfg)).toBe(1);
    expect(rootSubmergedFraction(12.5, 5, cfg)).toBeCloseTo(0.5);
    expect(rootSubmergedFraction(9, 5, cfg)).toBe(0);
    // รากยาวกว่าเข้าถึงน้ำได้มากกว่าที่ระดับน้ำเดียวกัน
    expect(rootSubmergedFraction(10, 12, cfg)).toBeGreaterThan(rootSubmergedFraction(10, 6, cfg));
  });

  it('supply is full once 30 % of the root length is submerged', () => {
    expect(rootSupplyRatio(0.3, cfg)).toBe(1);
    expect(rootSupplyRatio(0.15, cfg)).toBeCloseTo(0.5);
    expect(rootSupplyRatio(0, cfg)).toBe(0);
  });
});

describe('Plant water stress — AC-03 / AC-04 / AC-05', () => {
  it('AC-03: roots out of water → hydration falls and water stress rises', () => {
    const sim = new Simulation({ seed: 3 });
    sim.setWaterLevelPct(30); // 6 cm ต่ำกว่าปลายราก
    const { history } = run(sim, 3, { ledPct: 80 });

    const first = history[0]!;
    const last = history.at(-1)!;
    for (let i = 0; i < first.length; i++) {
      expect(last[i]!.hydration).toBeLessThan(first[i]!.hydration);
      expect(last[i]!.waterStress).toBeGreaterThan(0.3);
      expect(last[i]!.rootSubmerged).toBe(0);
    }
    // ลดลงต่อเนื่อง ไม่กระโดด
    for (let k = 1; k < history.length; k++) {
      expect(history[k]![0]!.hydration).toBeLessThanOrEqual(history[k - 1]![0]!.hydration);
      expect(history[k - 1]![0]!.hydration - history[k]![0]!.hydration).toBeLessThan(0.01);
    }
  });

  it('AC-04: refilling in time lowers water stress with no permanent damage', () => {
    const sim = new Simulation({ seed: 3 });
    sim.setWaterLevelPct(30);
    run(sim, 1.5, { ledPct: 80 });
    const stressed = sim.plants.map((p) => p.waterStress);
    const healthBeforeRefill = sim.plants.map((p) => p.health);
    expect(avg(stressed)).toBeGreaterThan(0.3);

    // เปิด Refill Pump 12 นาที (+24 L → 90 %)
    const refill = run(sim, 0.2, { ledPct: 80, refillPump: true });
    expect(levelPct(sim.env.waterVolumeL, cfg)).toBeCloseTo(90, 0);
    const recovery = run(sim, 6, { ledPct: 80 });
    const events = [...refill.events, ...recovery.events];

    for (const [i, p] of sim.plants.entries()) {
      expect(p.waterStress).toBeLessThan(0.1);
      expect(p.damage).toBe(0);
      // P12 รวม Nutrient Stress: เติมน้ำประปามากทำให้ EC เจือจาง แม้ Water Stress ฟื้นแล้ว
      expect(p.health).toBeGreaterThan(healthBeforeRefill[i]!);
      expect(p.nutrientStress).toBeGreaterThan(0);
    }
    expect(events.some((e) => e.kind === 'plant.water_stress_cleared')).toBe(true);
    expect(events.some((e) => e.kind === 'tank.roots_covered')).toBe(true);
  });

  it('AC-05: long shortage causes permanent damage that does not heal after refill', () => {
    const sim = new Simulation({ seed: 3 });
    sim.setWaterLevelPct(30);
    const dry = run(sim, 12, { ledPct: 80 });
    const damageAtRefill = sim.plants.map((p) => p.damage);
    for (const d of damageAtRefill) expect(d).toBeGreaterThan(0.2);

    run(sim, 0.2, { ledPct: 80, refillPump: true });
    const after = run(sim, 24, { ledPct: 80 });

    // Damage ไม่ลดลงตลอดช่วง
    const series = [...dry.history, ...after.history].map((ps) => ps[0]!.damage);
    for (let k = 1; k < series.length; k++) expect(series[k]!).toBeGreaterThanOrEqual(series[k - 1]!);

    sim.plants.forEach((p, i) => {
      expect(p.damage).toBeGreaterThanOrEqual(damageAtRefill[i]!);
      // ฟื้นได้แต่ไม่เต็ม
      expect(p.hydration).toBeLessThanOrEqual(hydrationCap(p.damage, cfg) + 1e-9);
      expect(p.hydration).toBeLessThan(0.95);
      expect(p.health).toBeLessThan(100 * (1 - p.damage) + 1e-9);
    });

    const kinds = new Set(dry.events.map((e) => e.kind));
    expect(kinds).toContain('tank.roots_exposed');
    expect(kinds).toContain('plant.water_stress');
    expect(kinds).toContain('plant.wilting');
    expect(kinds).toContain('plant.damage');
  });

  it('plants wilt more slowly in the dark than under strong light', () => {
    const lit = new Simulation({ seed: 3 });
    const dark = new Simulation({ seed: 3 });
    lit.setWaterLevelPct(30);
    dark.setWaterLevelPct(30);
    run(lit, 2, { ledPct: 100 });
    run(dark, 2, { ledPct: 0 });
    expect(dark.plants[0]!.hydration).toBeGreaterThan(lit.plants[0]!.hydration);
  });
});

describe('Growth baseline', () => {
  it('light and temperature factors follow their curves', () => {
    expect(lightFactor(0, cfg)).toBe(0);
    expect(lightFactor(250, cfg)).toBeCloseTo(1);
    expect(lightFactor(2000, cfg)).toBe(cfg.plant.lightFactorMax);
    expect(temperatureFactor(20, cfg)).toBe(1);
    expect(temperatureFactor(29, cfg)).toBeCloseTo(0.5);
    expect(temperatureFactor(35, cfg)).toBe(0);
  });

  it('morphology grows with biomass', () => {
    const small = morphology(5, cfg);
    const big = morphology(120, cfg);
    expect(small.stage).toBe('seedling');
    expect(big.stage).toBe('harvest');
    expect(big.leafCount).toBeGreaterThan(small.leafCount);
    expect(big.leafAreaCm2).toBeGreaterThan(small.leafAreaCm2);
    expect(big.rootLengthCm).toBeGreaterThan(small.rootLengthCm);
  });

  it('well-managed plants grow over 10 days and consume tank water', () => {
    const sim = new Simulation({ seed: 7 });
    const start = sim.plants.map((p) => ({ ...p }));
    run(sim, 24 * 10, goodCare(80), 10);

    sim.plants.forEach((p, i) => {
      const s = start[i]!;
      expect(p.biomassG).toBeGreaterThan(s.biomassG * 2.5);
      expect(p.leafCount).toBeGreaterThan(s.leafCount);
      expect(p.rootLengthCm).toBeGreaterThan(s.rootLengthCm);
      expect(p.damage).toBe(0);
      expect(p.health).toBeGreaterThan(90);
    });
    expect(sim.plants.some((p) => p.stage === 'vegetative')).toBe(true);
    expect(sim.env.totalUptakeL).toBeGreaterThan(1);
    expect(sim.plants[0]!.dliYesterday).toBeGreaterThan(10);
  });

  it('low light slows growth', () => {
    const bright = new Simulation({ seed: 7 });
    const dim = new Simulation({ seed: 7 });
    run(bright, 24 * 5, goodCare(80), 10);
    run(dim, 24 * 5, goodCare(15), 10);
    expect(avg(dim.plants.map((p) => p.biomassG))).toBeLessThan(avg(bright.plants.map((p) => p.biomassG)) * 0.8);
  });

  it('corner plants receive less light than centre plants (shared tank, own PPFD)', () => {
    const sim = new Simulation();
    run(sim, 0.1, { ledPct: 100 });
    const [corner, centre] = sim.plants;
    expect(corner!.ppfd).toBe(340);
    expect(centre!.ppfd).toBe(400);
  });
});

describe('Simulation', () => {
  it('is deterministic for the same seed and varies initial size by seed', () => {
    const a = new Simulation({ seed: 11 });
    const b = new Simulation({ seed: 11 });
    run(a, 1, { ledPct: 60 });
    run(b, 1, { ledPct: 60 });
    expect(a.snapshot()).toEqual(b.snapshot());
    expect(new Simulation({ seed: 12 }).plants[0]!.biomassG).not.toBe(new Simulation({ seed: 11 }).plants[0]!.biomassG);
  });

  it('reset restores the initial state', () => {
    const sim = new Simulation({ seed: 5 });
    const initial = sim.snapshot();
    sim.setWaterLevelPct(20);
    run(sim, 2, { ledPct: 100 });
    sim.reset();
    expect(sim.snapshot()).toEqual(initial);
  });

  it('leak disturbance drains the tank', () => {
    const sim = new Simulation();
    sim.disturbance.leakLph = 2;
    const before = sim.env.waterVolumeL;
    run(sim, 1, {});
    expect(before - sim.env.waterVolumeL).toBeCloseTo(2, 1);
    expect(sim.env.totalLeakL).toBeCloseTo(2, 6);
  });

  it('snapshot is a copy that cannot mutate the simulation', () => {
    const sim = new Simulation();
    const snap = sim.snapshot();
    snap.plants[0]!.hydration = 0;
    snap.env.waterVolumeL = 0;
    expect(sim.plants[0]!.hydration).toBe(1);
    expect(sim.env.waterVolumeL).toBeGreaterThan(0);
  });

  it('starts at day 14, 06:00 with the configured plant count', () => {
    const sim = new Simulation();
    expect(sim.readSimInfo()).toEqual({ day: 14, minuteOfDay: 360 });
    expect(sim.plants).toHaveLength(6);
  });
});
