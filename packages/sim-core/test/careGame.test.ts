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
  });
});
