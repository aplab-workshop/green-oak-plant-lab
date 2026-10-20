import { describe, expect, it } from 'vitest';
import type { ActuatorCommands } from '@gol/shared';
import {
  CHALLENGE_KINDS,
  DEFAULT_CONFIG,
  LEVELS,
  SECONDS_PER_DAY,
  Simulation,
  envEc,
  levelRound,
  makeConfig,
  planChallenges,
  type ChallengePlan,
  type ChallengeSpec,
  type RoundStart,
} from '../src';
import { OFF } from './helpers';

const cfg = DEFAULT_CONFIG;
const L3 = LEVELS.find((l) => l.id === 'L3')!;
const L4 = LEVELS.find((l) => l.id === 'L4')!;

/** ห้องคงที่ 26 °C ให้เทียบผลได้ชัด */
const flat = makeConfig({ room: { tempMeanC: 26, tempAmplitudeC: 0 } });

/** Simulation ที่มีเหตุการณ์ตามแผนที่กำหนด (เริ่มหลังเริ่มรอบ offsetS วินาที) */
function simWith(kind: ChallengePlan['kind'] | null, offsetS: number, durationS: number | null, round: RoundStart = {}) {
  const sim = new Simulation({ cfg: flat });
  sim.reset(round);
  const start = sim.startTimeS;
  sim.reset({ ...round, challengePlan: kind ? [{ id: 1, kind, startS: start + offsetS, durationS }] : [] });
  return sim;
}

function run(sim: Simulation, seconds: number, cmd: Partial<ActuatorCommands> = {}, dt = 10) {
  for (let t = 0; t < seconds; t += dt) sim.step(dt, { ...OFF, ...cmd });
}

const dayIndex = (startS: number, roundStartS: number) =>
  Math.floor(startS / SECONDS_PER_DAY) - Math.floor(roundStartS / SECONDS_PER_DAY);

describe('Challenge schedule — P23 / SPEC § 4.8', () => {
  const spec = L4.challenges!;
  const roundStart = 14 * SECONDS_PER_DAY + 6 * 3600;

  it('is deterministic for the same seed and level, and varies by seed', () => {
    expect(planChallenges(spec, 7, roundStart, cfg)).toEqual(planChallenges(spec, 7, roundStart, cfg));
    const plans = [1, 2, 3, 4, 5, 6].map((seed) => JSON.stringify(planChallenges(spec, seed, roundStart, cfg)));
    expect(new Set(plans).size).toBeGreaterThan(1);
    // ด่านต่างกัน (salt) ด้วย Seed เดียวกันได้ตารางต่างกัน
    const asL3: ChallengeSpec = { ...spec, salt: 3 };
    expect(planChallenges(asL3, 7, roundStart, cfg)).not.toEqual(planChallenges(spec, 7, roundStart, cfg));
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('L4 seed %i: 3–4 distinct kinds inside the window, at least 2 days apart', (seed) => {
    const plan = planChallenges(spec, seed, roundStart, cfg);
    expect(plan.length).toBeGreaterThanOrEqual(3);
    expect(plan.length).toBeLessThanOrEqual(4);
    expect(new Set(plan.map((p) => p.kind)).size).toBe(plan.length);
    plan.forEach((p, i) => {
      expect(CHALLENGE_KINDS).toContain(p.kind);
      const day = dayIndex(p.startS, roundStart);
      expect(day).toBeGreaterThanOrEqual(spec.windowDays[0]);
      expect(day).toBeLessThanOrEqual(spec.windowDays[1] + cfg.challenges.minGapDays * (plan.length - 1));
      if (i > 0) expect(day - dayIndex(plan[i - 1]!.startS, roundStart)).toBeGreaterThanOrEqual(cfg.challenges.minGapDays);
      expect(p.durationS === null).toBe(p.kind === 'leak');
    });
  });

  it('L3 has 1–2 heat waves starting around noon; L1, L2 and Free Play have none', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const plan = planChallenges(L3.challenges!, seed, roundStart, cfg);
      expect(plan.length).toBeGreaterThanOrEqual(1);
      expect(plan.length).toBeLessThanOrEqual(2);
      for (const p of plan) {
        expect(p.kind).toBe('heatWave');
        const hour = (p.startS % SECONDS_PER_DAY) / 3600;
        expect(hour).toBeGreaterThanOrEqual(11);
        expect(hour).toBeLessThanOrEqual(13);
        expect(p.durationS! / 3600).toBeGreaterThanOrEqual(6);
        expect(p.durationS! / 3600).toBeLessThanOrEqual(8);
      }
    }
    const sim = new Simulation();
    for (const id of ['L1', 'L2'] as const) {
      sim.reset(levelRound(LEVELS.find((l) => l.id === id)!));
      expect(sim.challenges).toEqual([]);
    }
    sim.reset({});
    expect(sim.challenges).toEqual([]);
  });
});

describe('Challenge lifecycle', () => {
  it('warns 6 h ahead, starts, ends, and only warned events are visible', () => {
    const sim = simWith('heatWave', 8 * 3600, 6 * 3600);
    run(sim, 1 * 3600);
    expect(sim.challengeViews()).toEqual([]);
    run(sim, 1.5 * 3600);
    expect(sim.challengeViews()).toMatchObject([{ kind: 'heatWave', status: 'warned' }]);
    run(sim, 6 * 3600);
    expect(sim.challengeViews()[0]!.status).toBe('active');
    run(sim, 6 * 3600);
    expect(sim.challengeViews()[0]!.status).toBe('done');
    const kinds = sim.drainEvents().map((e) => e.kind).filter((k) => k.startsWith('challenge.'));
    expect(kinds).toEqual(['challenge.warning', 'challenge.start', 'challenge.end']);
  });
});

describe('Challenge effects on the model', () => {
  it('heat wave raises air temperature by ≈5 °C', () => {
    const hot = simWith('heatWave', 0, 8 * 3600);
    const ctrl = simWith(null, 0, null);
    run(hot, 4 * 3600);
    run(ctrl, 4 * 3600);
    expect(hot.env.airTempC - ctrl.env.airTempC).toBeCloseTo(cfg.challenges.heatWaveDeltaC, 1);
  });

  it('dry air lowers RH by ≈20 %', () => {
    const dry = simWith('dryAir', 0, 12 * 3600);
    const ctrl = simWith(null, 0, null);
    run(dry, 4 * 3600);
    run(ctrl, 4 * 3600);
    expect(dry.env.rhPct - ctrl.env.rhPct).toBeCloseTo(cfg.challenges.dryAirRhDeltaPct, 0);
  });

  it('leak drains 1.5 L/h until repaired; repair without a leak returns false', () => {
    const leak = simWith('leak', 0, null);
    const ctrl = simWith(null, 0, null);
    expect(leak.repairLeak()).toBe(false); // ยังไม่เริ่ม
    run(leak, 2 * 3600);
    run(ctrl, 2 * 3600);
    expect(ctrl.env.waterVolumeL - leak.env.waterVolumeL).toBeCloseTo(3, 1);
    expect(leak.repairLeak()).toBe(true);
    const v = leak.env.waterVolumeL - ctrl.env.waterVolumeL;
    run(leak, 2 * 3600);
    run(ctrl, 2 * 3600);
    expect(leak.env.waterVolumeL - ctrl.env.waterVolumeL).toBeCloseTo(v, 2);
    expect(leak.challengeViews()[0]).toMatchObject({ status: 'done', repaired: true });
    expect(leak.repairLeak()).toBe(false);
  });

  it('power outage switches every actuator off, including LED and air pump', () => {
    const out = simWith('powerOutage', 0, 3 * 3600);
    const all = { fan: true, humidifier: true, ledPct: 100, refillPump: true, nutrientA: true, nutrientB: true, airPump: true, phDown: true };
    const before = out.env.waterVolumeL;
    run(out, 3600, all);
    expect(out.powerOutage).toBe(true);
    expect(out.env.ppfd).toBe(out.env.sunPpfd); // LED ดับ เหลือแต่แดด (P36)
    expect(out.env.powerW).toBe(0);
    expect(out.env.waterVolumeL).toBeLessThanOrEqual(before); // ปั๊มเติมน้ำไม่ทำงาน
    expect(out.env.estimatedOxygen).toBeLessThan(flat.root.initialOxygen); // ปั๊มลมดับ
    run(out, 2.5 * 3600, all);
    expect(out.powerOutage).toBe(false);
    expect(out.env.ppfd).toBeGreaterThan(out.env.sunPpfd);
  });

  it('alkaline tap water raises pH more when refilling', () => {
    const alk = simWith('alkalineTap', 0, 24 * 3600);
    const ctrl = simWith(null, 0, null);
    for (const s of [alk, ctrl]) {
      s.setWaterLevelPct(50);
      run(s, 10 * 60, { refillPump: true });
    }
    expect(alk.env.ph).toBeGreaterThan(ctrl.env.ph + 0.2);
    expect(envEc(alk.env)).toBeCloseTo(envEc(ctrl.env), 6);
  });
});
