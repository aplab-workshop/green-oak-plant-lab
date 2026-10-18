import { describe, expect, it } from 'vitest';
import type { ActuatorCommands } from '@gol/shared';
import { CareGame, LEVELS, Simulation, createPlant, levelRound, makeConfig, type LevelDef } from '../src';

/** สูตรดูแลตาม GAME-GUIDE: LED 06–22 น., Refill <70→90%, Fan >25.5/<24.5 °C, Humidifier <55/>70%, A+B EC <1.0→1.2 */
function playGuide(level: LevelDef, ledPct: number) {
  const sim = new Simulation({ cfg: makeConfig() });
  sim.reset(levelRound(level));
  sim.startGame();
  const cmd: ActuatorCommands = { fan: false, humidifier: false, ledPct: 0, refillPump: false, nutrientA: false, nutrientB: false, airPump: true };
  for (let s = 0; sim.game.status === 'playing'; s++) {
    if (s % 60 === 0) {
      const r = sim.readSensors(false);
      const minute = (sim.simTimeS % 86_400) / 60;
      cmd.ledPct = minute >= 360 && minute < 1320 ? ledPct : 0;
      cmd.refillPump = r.waterLevelPct < 70 ? true : r.waterLevelPct >= 90 ? false : cmd.refillPump;
      cmd.fan = r.airTempC > 25.5 ? true : r.airTempC < 24.5 ? false : cmd.fan;
      cmd.humidifier = r.rhPct < 55 ? true : r.rhPct > 70 ? false : cmd.humidifier;
      cmd.nutrientA = cmd.nutrientB = r.ecMsCm < 1.0 ? true : r.ecMsCm >= 1.2 ? false : cmd.nutrientA;
    }
    sim.step(1, cmd);
    if (sim.game.canHarvest) sim.harvest();
  }
  return sim.game;
}

describe('Levels & missions — P21 (SPEC § 4.6)', () => {
  it.each(LEVELS.map((l) => [l.id, l] as const))('%s: guide care wins with ⭐⭐⭐ and ≥ 15%% time to spare', (_id, level) => {
    const game = playGuide(level, 80);
    expect(game).toMatchObject({ status: 'won', stars: 3, deadPlantIds: [], targetG: level.targetG });
    expect(game.elapsedS).toBeLessThan(level.timeLimitDays * 86_400 * 0.85);
    expect(game.energyKWh).toBeLessThanOrEqual(level.energyBudgetKWh);
  }, 120_000);

  it('L1 without light runs out of time (timeout), not death', () => {
    const game = playGuide(LEVELS[0]!, 0);
    expect(game).toMatchObject({ status: 'lost', lostReason: 'timeout', score: 0, deadPlantIds: [] });
    expect(game.elapsedS).toBe(LEVELS[0]!.timeLimitDays * 86_400);
  }, 60_000);

  it('levels start from their growth chapter', () => {
    const sim = new Simulation({ cfg: makeConfig() });
    for (const l of LEVELS) {
      sim.reset(levelRound(l));
      const avg = sim.plants.reduce((a, p) => a + p.biomassG, 0) / sim.plants.length;
      expect(avg).toBeCloseTo(l.startBiomassG, -0.5);
      expect(sim.game).toMatchObject({ status: 'ready', targetG: l.targetG, timeLimitS: l.timeLimitDays * 86_400, energyBudgetKWh: l.energyBudgetKWh });
      expect(Math.floor(sim.startTimeS / 86_400)).toBe(l.startDay);
    }
    sim.reset({});
    expect(sim.game).toMatchObject({ targetG: 100, timeLimitS: null, energyBudgetKWh: null });
  });

  it('stars, energy and deadline auto-harvest', () => {
    const cfg = makeConfig();
    const plants = [createPlant(1, 0, 5, 0, cfg), createPlant(2, 1, 5, 0, cfg)];
    const ripe = plants.map((p) => ({ ...p, biomassG: 12 }));
    const mission = { targetG: 10, timeLimitS: 7200, energyBudgetKWh: 0.1 };
    // ใช้ไฟ 100 W 1 ชั่วโมง = 0.1 kWh (พอดีงบ) และครบเวลาขณะพร้อมเก็บ → เก็บอัตโนมัติ ⭐⭐⭐
    const a = new CareGame(plants, cfg, mission); a.start();
    a.step(plants, 3600, 3600, 100);
    a.step(ripe, 3600, 7200, 0);
    expect(a.snapshot()).toMatchObject({ status: 'won', stars: 3, endedAtS: 7200 });
    expect(a.snapshot().energyKWh).toBeCloseTo(0.1, 9);
    // เกินงบ → ⭐⭐
    const b = new CareGame(plants, cfg, mission); b.start();
    b.step(ripe, 3600, 3600, 200); b.harvest(ripe, 3600);
    expect(b.snapshot().stars).toBe(2);
    // ตาย 1 ต้น สุขภาพต่ำ → ⭐
    const c = new CareGame(plants, cfg, mission); c.start();
    const oneDead = [{ ...ripe[0]!, health: 50 }, { ...ripe[1]!, damage: 1, health: 0 }];
    c.step(oneDead, 3600, 3600, 0); c.harvest(oneDead, 3600);
    expect(c.snapshot().stars).toBe(1);
    // ไม่มีงบ (Free Play) ดูแค่สุขภาพ
    const d = new CareGame(plants, cfg, { targetG: 10, timeLimitS: null, energyBudgetKWh: null }); d.start();
    d.step(ripe, 3600, 3600, 10_000); d.harvest(ripe, 3600);
    expect(d.snapshot().stars).toBe(3);
  });
});
