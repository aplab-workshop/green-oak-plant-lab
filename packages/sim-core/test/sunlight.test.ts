import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, Simulation, makeConfig, simTimeFrom, sunPpfd } from '../src';
import { OFF } from './helpers';

/** P36 / SPEC § 4.19 — แสงแดดในโรงเรือน */
describe('Sunlight — P36', () => {
  const at = (h: number) => sunPpfd(simTimeFrom(14, h), DEFAULT_CONFIG);

  it('follows the day: dark at night, weak in the morning, peak 300 at 13:00, gone by 19:00', () => {
    expect(at(0)).toBe(0);
    expect(at(6)).toBe(0);
    expect(at(8)).toBeGreaterThan(50);
    expect(at(8)).toBeLessThan(200);
    expect(at(13)).toBeCloseTo(300, 9);
    expect(at(16)).toBeGreaterThan(at(8));
    expect(at(19)).toBe(0);
    expect(at(22)).toBe(0);
    expect(sunPpfd(simTimeFrom(14, 13), makeConfig({ sun: { peakPpfd: 0 } }))).toBe(0);
  });

  it('plant PPFD and the PAR sensor = sun + LED; corners lose LED share only', () => {
    const sim = new Simulation({ seed: 2 });
    sim.reset({ startDay: 14 });
    // เดินถึง 13:00
    while (Math.floor((sim.simTimeS % 86400) / 3600) < 13) sim.step(60, OFF);
    sim.step(1, { ...OFF, ledPct: 50 });
    const sun = sunPpfd(sim.simTimeS - 1, sim.cfg);
    const [corner, centre] = sim.plants;
    expect(centre!.ppfd).toBeCloseTo(sun + 200, 6);
    expect(corner!.ppfd).toBeCloseTo(sun + 170, 6);
    expect(sim.env.ppfd).toBeCloseTo(sim.env.sunPpfd + 200, 6);
    expect(sim.env.sunPpfd).toBeGreaterThan(290);
  });

  it('sun alone lets plants grow by day and adds to DLI; LED off at night means no growth', () => {
    const sim = new Simulation({ seed: 2 });
    const start = sim.plants[1]!.biomassG;
    for (let i = 0; i < 12 * 360; i++) sim.step(10, OFF); // 06:00–18:00 ไม่เปิดไฟ
    expect(sim.plants[1]!.biomassG).toBeGreaterThan(start);
    expect(sim.env.dliToday).toBeGreaterThan(5);
    const dusk = sim.plants[1]!.biomassG;
    for (let i = 0; i < 6 * 360; i++) sim.step(10, OFF); // หลัง 19:00 มืด
    const night = sim.plants[1]!.biomassG;
    for (let i = 0; i < 3 * 360; i++) sim.step(10, OFF);
    expect(sim.plants[1]!.biomassG).toBe(night);
    expect(night).toBeGreaterThan(dusk);
  });

  it('sun heats the air in the afternoon; the fan removes part of it', () => {
    const cfg = makeConfig({ room: { tempMeanC: 24, tempAmplitudeC: 0 } });
    const still = new Simulation({ seed: 2, cfg }), fan = new Simulation({ seed: 2, cfg });
    for (let i = 0; i < 7 * 360; i++) { still.step(10, OFF); fan.step(10, { ...OFF, fan: true }); } // ถึง 13:00
    expect(still.env.airTempC).toBeGreaterThan(25.5);
    expect(fan.env.airTempC).toBeLessThan(still.env.airTempC - 1);
    expect(fan.env.airTempC).toBeGreaterThanOrEqual(24 - 1e-6);
  });
});
