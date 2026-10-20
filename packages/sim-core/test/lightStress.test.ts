import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, Simulation, hourOfDay, makeConfig, stepLightStress } from '../src';
import { OFF, noSunConfig } from './helpers';
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
    // P12: Exposure นานสร้าง Damage และจำกัด Hydration ได้ แต่ไม่เหี่ยวทันทีตอนเปิดไฟ
    expect(f.plant.damage).toBeGreaterThan(0);
    expect(f.plant.hydration).toBeGreaterThan(0.9);
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
    const sim = new Simulation({ cfg: noSunConfig() });
    for (let i = 0; i < 7200; i++) sim.step(1, { ...OFF, ledPct: 100 });
    expect(sim.plants[1]!.lightStress).toBeGreaterThan(sim.plants[0]!.lightStress);
    expect(sim.plants[0]!.lightStress).toBe(0); // 340 PPFD < 350
  });

  it('AC-17: low light reduces growth with identical water and air temperature', () => {
    // ไฟต่อเนื่อง 72 ชม. — ปิด Photoperiod stress (P30) เพื่อแยกผลของแสงน้อยอย่างเดียว
    const cfg = makeConfig({ light: { photoperiodMaxStress: 0 } });
    const dim = plantFixture(cfg, { ledPct: 12.5 }); // 50 PPFD
    const lit = plantFixture(cfg); // 250 PPFD
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

describe('Photoperiod stress (LED นานเกิน) — P30', () => {
  const LED80 = 80; // 320 PPFD ที่ต้นกลาง < stressStartPpfd → ไม่มี Stress จากแสงแรง

  it('lights on 24 h builds light load past 18 h and slows growth versus a 16 h schedule', () => {
    const always = plantFixture(DEFAULT_CONFIG, { ledPct: LED80 });
    const schedule = plantFixture(DEFAULT_CONFIG);
    let maxScheduleLoad = 0;
    for (let i = 0; i < 4 * 86400; i += 10) {
      always.step(10);
      const h = hourOfDay(schedule.env.simTimeS);
      schedule.env.ledPct = h >= 6 && h < 22 ? LED80 : 0;
      schedule.step(10);
      maxScheduleLoad = Math.max(maxScheduleLoad, schedule.plant.lightLoadH);
    }
    expect(always.plant.lightLoadH).toBeGreaterThan(18);
    expect(always.plant.lightStress).toBeGreaterThan(0.3);
    expect(always.plant.lightStress).toBeLessThanOrEqual(DEFAULT_CONFIG.light.photoperiodMaxStress + 1e-9);
    expect(always.plant.damage).toBe(0); // เพดาน 0.6 < เกณฑ์ Damage 0.7
    expect(schedule.plant.lightStress).toBe(0);
    expect(maxScheduleLoad).toBeLessThan(DEFAULT_CONFIG.light.photoperiodMaxH);
    // ต่อวัน 16 ชม. ได้แสงน้อยกว่า แต่ไม่เครียด → โตใกล้เคียงหรือดีกว่าเปิดตลอด
    expect(schedule.plant.biomassG / 16).toBeGreaterThan(always.plant.biomassG / 24);
  });

  it('turning the lights off or dimming hard clears the load, then stress recovers', () => {
    const f = plantFixture(DEFAULT_CONFIG, { ledPct: LED80 });
    for (let i = 0; i < 30 * 3600; i += 10) f.step(10);
    const stressed = f.plant;
    expect(stressed.lightStress).toBeGreaterThan(0.2);
    f.env.ledPct = 0;
    // มืดล้างได้ 3 ชม.แสงต่อ 1 ชม. → สะสม 30 ชม. ต้องมืด 10 ชม.
    for (let i = 0; i < 8 * 3600; i += 10) f.step(10);
    expect(f.plant.lightLoadH).toBeCloseTo(6, 6);
    for (let i = 0; i < 2 * 3600; i += 10) f.step(10);
    expect(f.plant.lightLoadH).toBe(0);
    for (let i = 0; i < 12 * 3600; i += 10) f.step(10);
    expect(f.plant.lightStress).toBeLessThan(0.05);
    // หรี่ไฟเหลือ 10% (40 PPFD < restPpfd) ก็ล้างได้แต่ช้ากว่าปิดสนิท
    const dim = plantFixture(DEFAULT_CONFIG, { ledPct: LED80 });
    for (let i = 0; i < 20 * 3600; i += 10) dim.step(10);
    const before = dim.plant.lightLoadH;
    dim.env.ledPct = 10;
    for (let i = 0; i < 4 * 3600; i += 10) dim.step(10);
    expect(dim.plant.lightLoadH).toBeLessThan(before);
    expect(dim.plant.lightLoadH).toBeGreaterThan(Math.max(0, before - 12));
  });

  it('dimmer light accumulates load more slowly', () => {
    const bright = plantFixture(DEFAULT_CONFIG, { ledPct: LED80 });
    const half = plantFixture(DEFAULT_CONFIG, { ledPct: 40 }); // 160 PPFD
    for (let i = 0; i < 10 * 3600; i += 10) { bright.step(10); half.step(10); }
    expect(bright.plant.lightLoadH).toBeCloseTo(10, 6);
    expect(half.plant.lightLoadH).toBeCloseTo(10 * 160 / 250, 6);
  });
});
