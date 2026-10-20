import { describe, expect, it } from 'vitest';
import type { ActuatorCommands } from '@gol/shared';
import { CareGame, LEVELS, Simulation, createPlant, levelRound, makeConfig, type LevelDef } from '../src';

/**
 * สูตรดูแลตาม GAME-GUIDE: LED 06–22 น. เติมให้ PPFD ~300 (P36 มีแดด), Refill <70→90%, Fan >25.5/<24.5 °C, Humidifier <55/>70%, A+B EC <1.0→1.2
 * + รับมือเหตุการณ์ (SPEC § 4.8): คลื่นความร้อน LED 40%, pH Down >6.6→6.3, ซ่อมถังทันทีที่รั่ว
 */
function playGuide(level: LevelDef, ledPct: number, seed = 1) {
  const sim = new Simulation({ cfg: makeConfig(), seed });
  sim.reset(levelRound(level));
  sim.startGame();
  const cmd: ActuatorCommands = { fan: false, humidifier: false, ledPct: 0, refillPump: false, nutrientA: false, nutrientB: false, airPump: true, phDown: false };
  for (let s = 0; sim.game.status === 'playing'; s++) {
    if (s % 60 === 0) {
      const r = sim.readSensors(false);
      const minute = (sim.simTimeS % 86_400) / 60;
      const heat = sim.challenges.some((c) => c.kind === 'heatWave' && c.status === 'active');
      // P36: เติม LED เท่าที่แดดขาดให้ PPFD กลางถัง ~300 (ทีละ 5 %), ไม่เกิน ledPct ที่กำหนด
      const topUp = Math.min(ledPct, Math.max(0, Math.round((300 - sim.env.sunPpfd) / 4 / 5) * 5));
      cmd.ledPct = minute >= 360 && minute < 1320 ? (heat ? Math.min(topUp, 40) : topUp) : 0;
      cmd.refillPump = r.waterLevelPct < 70 ? true : r.waterLevelPct >= 90 ? false : cmd.refillPump;
      cmd.fan = r.airTempC > 25.5 ? true : r.airTempC < 24.5 ? false : cmd.fan;
      cmd.humidifier = r.rhPct < 55 ? true : r.rhPct > 70 ? false : cmd.humidifier;
      cmd.nutrientA = cmd.nutrientB = r.ecMsCm < 1.0 ? true : r.ecMsCm >= 1.2 ? false : cmd.nutrientA;
      cmd.phDown = r.ph > 6.6 ? true : r.ph <= 6.3 ? false : cmd.phDown;
      // P37: ด่านที่ล็อกแบบ 'off' — อุปกรณ์ที่ไม่ได้ปลดล็อกปิดสนิท (ปั๊มลมเปิด)
      if (level.lockedMode === 'off') {
        const own = (d: (typeof level.playerDevices)[number]) => level.playerDevices.includes(d);
        if (!own('fan')) cmd.fan = false;
        if (!own('humidifier')) cmd.humidifier = false;
        if (!own('nutrient')) cmd.nutrientA = cmd.nutrientB = false;
        if (!own('phDown')) cmd.phDown = false;
      }
      if (sim.challenges.some((c) => c.kind === 'leak' && c.status === 'active')) sim.repairLeak();
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

describe('Ignored plant factors — P38 (SPEC § 4.21)', () => {
  const L1 = LEVELS.find((l) => l.id === 'L1')!;
  const grow = (cfg: Parameters<typeof makeConfig>[0], round = levelRound(L1)) => {
    const sim = new Simulation({ cfg: makeConfig(cfg), seed: 4 });
    sim.reset(round);
    const cmd: ActuatorCommands = { fan: false, humidifier: false, ledPct: 0, refillPump: true, nutrientA: false, nutrientB: false, airPump: true, phDown: false };
    for (let s = 0; s < 2 * 86400; s += 10) {
      const lvl = sim.readSensors(false).waterLevelPct;
      cmd.refillPump = lvl < 70 ? true : lvl >= 90 ? false : cmd.refillPump;
      cmd.ledPct = 60;
      sim.step(10, cmd);
    }
    return sim;
  };

  it('L1: temperature, humidity and EC/pH do not change plant growth or stress', () => {
    const base = grow({});
    const hot = grow({ room: { tempMeanC: 31, tempAmplitudeC: 0, rhPct: 25 } });
    const salty = grow({ nutrient: { initialEc: 3.5, initialPh: 8.5 } });
    const mass = (s: Simulation) => s.plants.map((p) => p.biomassG);
    expect(hot.env.airTempC).toBeGreaterThan(base.env.airTempC + 4);
    // ต่างกันได้เพียงเศษเล็กน้อยจากจังหวะเติมน้ำ (น้ำระเหยตามอุณหภูมิ = กลไกน้ำที่ผู้เล่นคุม)
    mass(hot).forEach((g, i) => expect(g).toBeCloseTo(mass(base)[i]!, 3));
    mass(salty).forEach((g, i) => expect(g).toBeCloseTo(mass(base)[i]!, 3));
    for (const s of [base, hot, salty]) {
      expect(s.plants.every((p) => p.nutrientStress === 0 && p.dryAirStress === 0 && p.humidAirStress === 0)).toBe(true);
    }
  });

  it('L1: water and light still matter; other levels keep every factor', () => {
    const base = grow({});
    const dim = (() => {
      const sim = new Simulation({ cfg: makeConfig(), seed: 4 });
      sim.reset(levelRound(L1));
      for (let s = 0; s < 2 * 86400; s += 10) sim.step(10, { fan: false, humidifier: false, ledPct: 0, refillPump: sim.readSensors(false).waterLevelPct < 80, nutrientA: false, nutrientB: false, airPump: true, phDown: false });
      return sim;
    })();
    expect(dim.plants[1]!.biomassG).toBeLessThan(base.plants[1]!.biomassG);
    const L2 = LEVELS.find((l) => l.id === 'L2')!;
    const l2 = grow({}, levelRound(L2));
    const l2hot = grow({ room: { tempMeanC: 31, tempAmplitudeC: 0 } }, levelRound(L2));
    expect(l2hot.plants[1]!.biomassG).toBeLessThan(l2.plants[1]!.biomassG);
  });
});
