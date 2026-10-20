import { describe, expect, it } from 'vitest';
import { CareGame } from '../src/careGame';
import { createPlant, makeConfig, plantWaterRequest, Simulation, stepPlant } from '../src';
import { plantFixture } from './plantFixture';
import { OFF } from './helpers';

describe('Care score and permanent death — P17', () => {
  it('rewards sustained health and growth, penalizes deaths, and locks defeat', () => {
    const cfg = makeConfig();
    const plants = [createPlant(1, 0, 5, 0, cfg), createPlant(2, 1, 5, 0, cfg)];
    const good = new CareGame(plants, cfg), poor = new CareGame(plants, cfg);
    good.start(); poor.start();
    expect(good.snapshot().score).toBe(0);
    const mature = plants.map((p) => ({ ...p, biomassG: 100 }));
    good.step(mature, 3600, 3600);
    poor.step(mature.map((p) => ({ ...p, health: 40 })), 3600, 3600);
    expect(good.snapshot().score).toBe(1000);
    expect(poor.snapshot().score).toBe(520);
    good.step([mature[0]!, { ...mature[1]!, damage: 1, health: 0 }], 3600, 7200);
    expect(good.snapshot().status).toBe('playing');
    expect(good.snapshot().deadPlantIds).toEqual([2]);
    expect(good.snapshot().score).toBeLessThan(500);
    good.step(mature.map((p) => ({ ...p, damage: 1, health: 0 })), 3600, 10800);
    const lost = good.snapshot();
    expect(lost).toMatchObject({ score: 0, status: 'lost', endedAtS: 10800 });
    good.step(mature, 3600, 14400);
    expect(good.snapshot()).toEqual(lost);
    lost.deadPlantIds.push(99);
    expect(good.snapshot().deadPlantIds).toEqual([1, 2]);
  });

  it('uses simulated duration when averaging health', () => {
    const cfg = makeConfig(); const p = createPlant(1, 0, 5, 0, cfg);
    const game = new CareGame([p], cfg); game.start();
    game.step([p], 10, 10);
    game.step([{ ...p, health: 50 }], 30, 40);
    expect(game.snapshot().averageHealth).toBe(62.5);
    expect(game.snapshot().score).toBe(500);
    game.step([p], 0, 40);
    expect(game.snapshot().elapsedS).toBe(40);
  });

  it('dead plants cannot revive, grow or take water even in ideal conditions', () => {
    const cfg = makeConfig(); const f = plantFixture(cfg);
    const dead = { ...f.plant, damage: 1, health: 0, hydration: 0 };
    const request = plantWaterRequest(dead, f.env, cfg);
    expect(request.demandLPerDay).toBe(0);
    const after = stepPlant(dead, request, f.env, 1, 86400, cfg);
    expect(after).toMatchObject({ biomassG: dead.biomassG, rootLengthCm: dead.rootLengthCm, health: 0, damage: 1, hydration: 0, supplyRatio: 0 });
  });

  it('dry-tank simulation reaches defeat once, while healthy control scores higher; reset restores plants', () => {
    const cfg = makeConfig({ plant: { initialBiomassSpread: 0 } });
    const dry = new Simulation({ cfg }), healthy = new Simulation({ cfg });
    dry.setWaterLevelPct(0); dry.startGame(); healthy.startGame();
    const cmd = { ...OFF, ledPct: 60, fan: true };
    for (let i = 0; i < 36 * 3600; i++) { dry.step(1, cmd); healthy.step(1, cmd); }
    expect(dry.game.status).toBe('lost');
    expect(healthy.game.score).toBeGreaterThan(dry.game.score);
    const events = dry.drainEvents();
    expect(events.filter((e) => e.kind === 'game.over')).toHaveLength(1);
    expect(events.filter((e) => e.kind === 'plant.died')).toHaveLength(6);
    const frozen = dry.game;
    dry.setWaterLevelPct(85); dry.step(3600, cmd);
    expect(dry.game).toEqual(frozen);
    dry.reset();
    expect(dry.game).toMatchObject({ status: 'ready', score: 0, elapsedS: 0, deadPlantIds: [] });
    expect(dry.plants.every((p) => p.damage === 0)).toBe(true);
  }, 30000);
});

describe('Overflow penalty — P29', () => {
  it('deducts points per litre lost (capped, never below 0) and keeps the round winnable', () => {
    const cfg = makeConfig();
    const plants = [createPlant(1, 0, 5, 0, cfg)];
    const mature = plants.map((p) => ({ ...p, biomassG: 100 }));
    const game = new CareGame(plants, cfg);
    game.step(mature, 60, 60, 18, 5, 18); // ready: ไม่นับ
    expect(game.snapshot()).toMatchObject({ overflowL: 0, overflowPenalty: 0 });
    game.start();
    game.step(mature, 60, 120, 18, 2, 18);
    expect(game.snapshot()).toMatchObject({ overflowL: 2, overflowPenalty: 20, score: 980 });
    expect(game.snapshot().overflowKWh).toBeCloseTo(18 * 60 / 3_600_000, 12);
    game.step(mature, 60, 180, 0, 0, 0);
    expect(game.snapshot().overflowKWh).toBeCloseTo(18 * 60 / 3_600_000, 12);
    game.step(mature, 60, 240, 18, 100, 18);
    expect(game.snapshot()).toMatchObject({ overflowL: 102, overflowPenalty: 300, score: 700, status: 'playing', canHarvest: true });
    expect(game.harvest(mature, 240)).toBe(true);
    expect(game.snapshot()).toMatchObject({ status: 'won', stars: 3, score: 700 + game.snapshot().harvestBonus });
  });

  it('score floor is zero', () => {
    const cfg = makeConfig({ game: { overflowPenaltyMax: 5000 } });
    const p = createPlant(1, 0, 5, 0, cfg);
    const game = new CareGame([p], cfg); game.start();
    game.step([{ ...p, health: 10 }], 60, 60, 0, 400, 0);
    expect(game.snapshot().score).toBe(0);
  });

  it('simulation counts overflow from a refill pump left on at a full tank', () => {
    const sim = new Simulation({ seed: 3 });
    sim.startGame();
    for (let i = 0; i < 3 * 3600; i += 10) sim.step(10, { ...OFF, refillPump: true });
    const g = sim.game;
    expect(sim.env.totalOverflowL).toBeGreaterThan(1);
    expect(g.overflowL).toBeCloseTo(sim.env.totalOverflowL, 6);
    expect(g.overflowPenalty).toBe(Math.min(300, Math.round(g.overflowL * 10)));
    expect(g.overflowKWh).toBeGreaterThan(0);
    expect(g.status).toBe('playing');
  });
});

describe('Harvest progress and growth rate — P35', () => {
  it('harvestProgress is the least-advanced living plant and reaches 1 exactly when harvest is allowed', () => {
    const cfg = makeConfig();
    const plants = [createPlant(1, 0, 5, 0, cfg), createPlant(2, 1, 10, 0, cfg)];
    const game = new CareGame(plants, cfg, { targetG: 20, timeLimitS: null, energyBudgetKWh: null });
    game.start();
    game.step([{ ...plants[0]!, biomassG: 12.5 }, { ...plants[1]!, biomassG: 12 }], 60, 60);
    expect(game.snapshot().harvestProgress).toBeCloseTo(0.2, 12); // ต้น 2: (12−10)/(20−10)
    expect(game.snapshot().canHarvest).toBe(false);
    game.step([{ ...plants[0]!, biomassG: 20 }, { ...plants[1]!, damage: 1, health: 0 }], 60, 120);
    expect(game.snapshot()).toMatchObject({ harvestProgress: 1, canHarvest: true }); // ต้นที่ตายไม่นับ
  });

  it('growthGPerH matches the biomass change and efficiency is ~1 under the care recipe at noon', () => {
    const sim = new Simulation({ seed: 3 });
    const fan = (s: Simulation) => ({ ...OFF, ledPct: 80, fan: s.env.airTempC > 25 });
    for (let i = 0; i < 6 * 360; i++) sim.step(10, fan(sim));
    const before = sim.plants.map((p) => p.biomassG);
    sim.step(10, fan(sim));
    sim.plants.forEach((p, i) => {
      expect(p.growthGPerH).toBeCloseTo((p.biomassG - before[i]!) * 360, 9);
      expect(p.growthGPerH).toBeGreaterThan(0);
    });
    expect(sim.plants[1]!.growthEfficiency).toBeGreaterThan(0.8);
    expect(sim.plants[1]!.growthEfficiency).toBeLessThanOrEqual(sim.cfg.plant.lightFactorMax);
    const dark = new Simulation({ seed: 3 });
    for (let i = 0; i < 360; i++) dark.step(10, OFF);
    expect(dark.plants.every((p) => p.growthGPerH === 0 && p.growthEfficiency === 0)).toBe(true);
  });
});
