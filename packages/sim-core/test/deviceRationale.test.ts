import { describe, expect, it } from 'vitest';
import type { ActuatorCommands } from '@gol/shared';
import { Simulation, hourOfDay, levelPct, type SimConfig } from '../src';
import { OFF, noSunConfig } from './helpers';

/**
 * P32 / SPEC § 4.15 — เหตุผลของอุปกรณ์แต่ละตัว: ปัญหา → อุปกรณ์ → ผลดี → ผลข้างเคียง
 * ทุกข้อเทียบ "เปิด/ไม่เปิด" ด้วย Seed เดียวกันใน Simulation จริง
 */

type CmdFn = (sim: Simulation) => Partial<ActuatorCommands>;

function run(sim: Simulation, hours: number, cmd: CmdFn, dtS = 10): void {
  for (let i = 0; i < (hours * 3600) / dtS; i++) sim.step(dtS, { ...OFF, ...cmd(sim) });
}

/** ตารางไฟ 06–22 ตามสูตรดูแล */
const lightOn = (sim: Simulation, led = 80) => (hourOfDay(sim.simTimeS) >= 6 && hourOfDay(sim.simTimeS) < 22 ? led : 0);
/** ดูแลพื้นฐาน: ไฟตามตาราง + เติมน้ำเมื่อ < 70 % */
const basic = (sim: Simulation, led = 80): Partial<ActuatorCommands> => ({
  ledPct: lightOn(sim, led),
  refillPump: levelPct(sim.env.waterVolumeL, sim.cfg) < 70,
});
const avg = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const biomass = (sim: Simulation) => avg(sim.plants.map((p) => p.biomassG));
const ec = (sim: Simulation) => sim.readSensors(false).ecMsCm;
// แยกผลของอุปกรณ์: ปิดแดด (P36) ให้ "LED ปิด = มืด" และไม่มีความร้อนจากแดดปน
const sim = (cfg?: SimConfig) => new Simulation({ seed: 5, cfg: cfg ?? noSunConfig() });

describe('Ventilation Fan (M100)', () => {
  const cfg = noSunConfig({ room: { tempMeanC: 23, tempAmplitudeC: 0 } });

  it('P48: fan at half speed cools LED heat to a good temperature and so restores growth', () => {
    const hot = sim(cfg), fan = sim(cfg);
    run(hot, 48, (s) => basic(s, 100));
    run(fan, 48, (s) => ({ ...basic(s, 100), fanPct: 50 }));
    // วัดตอนไฟเปิด (หลังเที่ยงวันของวันที่ 2)
    run(hot, 6, (s) => basic(s, 100));
    run(fan, 6, (s) => ({ ...basic(s, 100), fanPct: 50 }));
    expect(hot.env.airTempC).toBeGreaterThan(27);
    expect(fan.env.airTempC).toBeLessThan(hot.env.airTempC - 3);
    expect(biomass(fan)).toBeGreaterThan(biomass(hot));
  });

  it('P48: full speed with no heat source cools below the room (too cold at night — slow it down)', () => {
    const still = sim(cfg), fan = sim(cfg);
    run(still, 6, () => ({ ledPct: 0 }));
    run(fan, 6, () => ({ ledPct: 0, fanPct: 100 }));
    expect(still.env.airTempC).toBeCloseTo(23, 3);
    expect(fan.env.airTempC).toBeCloseTo(14, 1);
  });
});

describe('Humidifier (M101)', () => {
  const dry = noSunConfig({ room: { tempMeanC: 24, tempAmplitudeC: 0, rhPct: 35 } });

  it('raises RH in dry air and lowers the plants water demand', () => {
    const off = sim(dry), on = sim(dry);
    run(off, 10, (s) => basic(s));
    run(on, 10, (s) => ({ ...basic(s), humidifier: true }));
    expect(on.env.rhPct).toBeGreaterThan(off.env.rhPct + 15);
    expect(avg(on.plants.map((p) => p.demandLPerDay))).toBeLessThan(avg(off.plants.map((p) => p.demandLPerDay)));
    expect(on.env.totalUptakeL).toBeLessThan(off.env.totalUptakeL);
  });
});

describe('Water Refill Pump (M102)', () => {
  it('low water exposes roots → hydration drops and growth slows; refilling restores it', () => {
    const cfg = noSunConfig({ tank: { initialLevelPct: 45 } });
    const dryTank = sim(cfg), refilled = sim(cfg);
    run(dryTank, 24, (s) => ({ ledPct: lightOn(s) }));
    run(refilled, 24, (s) => basic(s));
    expect(avg(dryTank.plants.map((p) => p.hydration))).toBeLessThan(0.9);
    expect(avg(refilled.plants.map((p) => p.hydration))).toBeGreaterThan(0.97);
    expect(biomass(refilled)).toBeGreaterThan(biomass(dryTank));
  });

  it('overflowing drains nutrient solution: EC falls, pH moves toward tap water, points are deducted', () => {
    const calm = sim(), flood = sim();
    calm.startGame(); flood.startGame();
    run(calm, 2, () => ({ ledPct: 80 }));
    run(flood, 2, () => ({ ledPct: 80, refillPump: true }));
    expect(flood.env.totalOverflowL).toBeGreaterThan(50);
    expect(ec(flood)).toBeLessThan(ec(calm) - 0.3);
    expect(flood.env.ph).toBeGreaterThan(calm.env.ph + 0.3);
    expect(flood.game.overflowPenalty).toBeGreaterThan(0);
    expect(flood.game.status).toBe('playing');
  });
});

describe('Nutrient Pump A+B (M103/M104)', () => {
  it('low EC causes nutrient stress; dosing A+B together back into range recovers it', () => {
    const cfg = noSunConfig({ nutrient: { initialEc: 0.3 } });
    const hungry = sim(cfg), fed = sim(cfg);
    run(hungry, 24, (s) => basic(s));
    run(fed, 24, (s) => { const dose = ec(s) < 1.2; return { ...basic(s), nutrientA: dose, nutrientB: dose }; });
    expect(avg(hungry.plants.map((p) => p.nutrientStress))).toBeGreaterThan(0.3);
    expect(ec(fed)).toBeGreaterThan(0.9);
    expect(avg(fed.plants.map((p) => p.nutrientStress))).toBeLessThan(0.1);
    expect(biomass(fed)).toBeGreaterThan(biomass(hungry));
  });

  it('extra nutrient inside the good range is no growth bonus; too much causes stress', () => {
    const ok = sim(noSunConfig({ nutrient: { initialEc: 1.2 } }));
    const richer = sim(noSunConfig({ nutrient: { initialEc: 1.5 } }));
    const tooMuch = sim(noSunConfig({ nutrient: { initialEc: 2.8 } }));
    for (const s of [ok, richer, tooMuch]) run(s, 24, (x) => basic(x));
    expect(biomass(richer)).toBeCloseTo(biomass(ok), 9);
    expect(avg(tooMuch.plants.map((p) => p.nutrientStress))).toBeGreaterThan(0.3);
    expect(biomass(tooMuch)).toBeLessThan(biomass(ok));
  });
});

describe('Air Pump (M105)', () => {
  it('off for long → oxygen and root health fall → plants take up less water and grow slower even with a full tank', () => {
    const on = sim(), off = sim();
    run(on, 36, (s) => basic(s));
    run(off, 36, (s) => ({ ...basic(s), airPump: false }));
    expect(levelPct(off.env.waterVolumeL, off.cfg)).toBeGreaterThan(65);
    expect(off.env.estimatedOxygen).toBeLessThan(on.env.estimatedOxygen - 0.3);
    expect(avg(off.plants.map((p) => p.rootHealth))).toBeLessThan(avg(on.plants.map((p) => p.rootHealth)) - 0.2);
    expect(avg(off.plants.map((p) => p.supplyRatio))).toBeLessThan(avg(on.plants.map((p) => p.supplyRatio)));
    expect(biomass(off)).toBeLessThan(biomass(on));
  });
});

describe('pH Down Pump (M106)', () => {
  const alkaline = noSunConfig({ nutrient: { initialPh: 8.0 } });

  it('high pH causes nutrient stress even with good EC; dosing pH Down into range recovers', () => {
    const high = sim(alkaline), fixed = sim(alkaline);
    run(high, 24, (s) => basic(s));
    run(fixed, 24, (s) => ({ ...basic(s), phDown: s.env.ph > 6.2 }));
    expect(ec(high)).toBeGreaterThan(0.8);
    expect(avg(high.plants.map((p) => p.nutrientStress))).toBeGreaterThan(0.2);
    expect(fixed.env.ph).toBeLessThan(6.5);
    expect(avg(fixed.plants.map((p) => p.nutrientStress))).toBeLessThan(0.1);
    expect(biomass(fixed)).toBeGreaterThan(biomass(high));
  });

  it('left on, pH drops too low and nutrient stress returns', () => {
    const stuck = sim();
    run(stuck, 24, (s) => ({ ...basic(s), phDown: true }));
    expect(stuck.env.ph).toBeLessThan(5);
    expect(avg(stuck.plants.map((p) => p.nutrientStress))).toBeGreaterThan(0.2);
  });
});

describe('Grow Light (D200)', () => {
  it('no light → no biomass gain; dim light grows slower than the recipe', () => {
    const dark = sim(), dim = sim(), lit = sim();
    const start = biomass(dark);
    run(dark, 24, (s) => ({ ...basic(s), ledPct: 0 }));
    // เปิดพัดลมเหมือนผู้ช่วยฟาร์ม เพื่อแยกผลของแสงออกจากความร้อนของ LED
    run(dim, 48, (s) => ({ ...basic(s, 20), fanPct: 100 }));
    run(lit, 48, (s) => ({ ...basic(s, 80), fanPct: 100 }));
    expect(biomass(dark)).toBe(start);
    expect(biomass(dim) - start).toBeLessThan((biomass(lit) - start) * 0.75);
  });

  it('strong light adds heat, water demand and light stress', () => {
    const cfg = noSunConfig({ room: { tempMeanC: 24, tempAmplitudeC: 0 } });
    const off = sim(cfg), full = sim(cfg);
    run(off, 4, () => ({ ledPct: 0 }));
    run(full, 4, () => ({ ledPct: 100 }));
    expect(full.env.airTempC).toBeGreaterThan(off.env.airTempC + 4);
    expect(avg(full.plants.map((p) => p.demandLPerDay))).toBeGreaterThan(avg(off.plants.map((p) => p.demandLPerDay)) * 2);
    // ต้นกลาง 400 PPFD > 350 → Light stress (ใบม้วน)
    expect(full.plants[1]!.lightStress).toBeGreaterThan(0.1);
    expect(off.plants[1]!.lightStress).toBe(0);
  });
});
