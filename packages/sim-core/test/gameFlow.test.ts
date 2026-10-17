import { describe, expect, it } from 'vitest';
import { CareGame } from '../src/careGame';
import { SIM_SPEEDS, SimClock, createPlant, makeConfig } from '../src';

describe('Garden game flow — P20 (SPEC § 4.5)', () => {
  const cfg = makeConfig();
  const seedlings = () => [createPlant(1, 0, 5, 0, cfg), createPlant(2, 1, 5, 0, cfg)];

  it('starts in ready, ignores steps until start, and starts only once', () => {
    const game = new CareGame(seedlings(), cfg);
    expect(game.snapshot()).toMatchObject({ status: 'ready', canHarvest: false, harvestBonus: 0, yieldG: null, testRun: false });
    game.step(seedlings(), 3600, 3600);
    expect(game.snapshot()).toMatchObject({ status: 'ready', elapsedS: 0, score: 0 });
    expect(game.start()).toBe(true);
    expect(game.start()).toBe(false);
    game.step(seedlings(), 3600, 3600);
    expect(game.snapshot()).toMatchObject({ status: 'playing', elapsedS: 3600 });
  });

  it('allows harvest only when every surviving plant reaches harvestAtG, then freezes the round', () => {
    const game = new CareGame(seedlings(), cfg); game.start();
    const [a, b] = seedlings();
    const half = [{ ...a!, biomassG: 100 }, { ...b!, biomassG: 60 }];
    game.step(half, 3600, 3600);
    expect(game.snapshot().canHarvest).toBe(false);
    expect(game.harvest(half, 3600)).toBe(false);
    // ต้นที่ 2 ตาย → ต้นที่รอดทุกต้นถึง 100 g → เก็บเกี่ยวได้ แต่คะแนนลด
    const oneDead = [{ ...a!, biomassG: 120 }, { ...b!, biomassG: 60, damage: 1, health: 0 }];
    game.step(oneDead, 3600, 7200);
    const before = game.snapshot();
    expect(before).toMatchObject({ status: 'playing', canHarvest: true });
    expect(game.harvest(oneDead, 7200)).toBe(true);
    const won = game.snapshot();
    const bonus = Math.round(cfg.game.harvestBonus * 0.5 * before.averageHealth / 100);
    expect(won).toMatchObject({ status: 'won', endedAtS: 7200, yieldG: 120, harvestBonus: bonus, score: before.score + bonus, canHarvest: false });
    game.step(oneDead, 3600, 10800);
    expect(game.harvest(oneDead, 10800)).toBe(false);
    expect(game.snapshot()).toEqual(won);
  });

  it('perfect care earns 1000 + full harvest bonus', () => {
    const game = new CareGame(seedlings(), cfg); game.start();
    const mature = seedlings().map((p) => ({ ...p, biomassG: 100 }));
    game.step(mature, 3600, 3600);
    expect(game.harvest(mature, 3600)).toBe(true);
    expect(game.snapshot()).toMatchObject({ score: cfg.game.maxScore + cfg.game.harvestBonus, yieldG: 200 });
  });

  it('cannot harvest when every plant is dead; testRun is sticky only while playing', () => {
    const game = new CareGame(seedlings(), cfg);
    game.markTestRun();
    expect(game.snapshot().testRun).toBe(false);
    game.start(); game.markTestRun();
    expect(game.snapshot().testRun).toBe(true);
    const dead = seedlings().map((p) => ({ ...p, biomassG: 120, damage: 1, health: 0 }));
    game.step(dead, 3600, 3600);
    expect(game.snapshot()).toMatchObject({ status: 'lost', canHarvest: false, testRun: true });
    expect(game.harvest(dead, 3600)).toBe(false);
  });

  it('supports 1440x and 3600x speeds', () => {
    expect(SIM_SPEEDS).toEqual([1, 60, 360, 1440, 3600]);
    const clock = new SimClock({ startS: 0, dtS: 1, maxStepsPerTick: 5000 });
    clock.setSpeed(3600);
    let steps = 0;
    clock.advance(1000, () => steps++);
    expect(steps).toBe(3600);
  });
});
