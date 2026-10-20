import { describe, expect, it } from 'vitest';
import type { EventEntry, HistorySample, PlantState } from '@gol/shared';
import { buildLossStory, plantCause } from '../src/dashboard/lossStory';

const DAY = 86_400;
const START = 14 * DAY + 6 * 3600; // Day 14 06:00
const plant = (id: number, over: Partial<PlantState> = {}): PlantState => ({
  id, position: id - 1, ageDays: 14, stage: 'seedling', biomassG: 6, leafCount: 7, leafAreaCm2: 60, rootLengthCm: 6,
  hydration: 1, waterStress: 0, lightStress: 0, nutrientStress: 0, rootHealth: 1, damage: 0, health: 100,
  rootSubmerged: 1, supplyRatio: 1, demandLPerDay: 0, ppfd: 0, dliToday: 0, dliYesterday: 0, lightLoadH: 0, dryAirStress: 0, humidAirStress: 0, biomassDayStartG: 5, gainYesterdayG: null, stageChangedAtS: null, ...over,
});
let nextId = 1;
const ev = (t: number, kind: string, plantId?: number): EventEntry =>
  ({ id: nextId++, runId: 1, at: 0, simTimeS: START + t, kind, severity: 'warning', message: kind, plantId });
const sample = (t: number, over: Partial<HistorySample> = {}): HistorySample => ({
  simTimeS: START + t, waterLevelPct: 50, airTempC: 24, rhPct: 60, ppfd: 300, ecMsCm: 1.2, ph: 6,
  avgHydration: 1, avgWaterStress: 0, avgHealth: 100, avgBiomassG: 6, estimatedOxygen: 0.9, plants: [], ...over,
});

describe('Game Over story', () => {
  it('picks the dominant frozen stress as a plant cause', () => {
    expect(plantCause(plant(1, { hydration: 0.1, waterStress: 0.9 }))).toBe('water');
    expect(plantCause(plant(1, { lightStress: 0.95, waterStress: 0.3 }))).toBe('heat');
    expect(plantCause(plant(1, { nutrientStress: 0.8 }))).toBe('nutrient');
    expect(plantCause(plant(1, { rootHealth: 0.05 }))).toBe('root');
  });

  it('tells a dry-tank death story in time order with grouped deaths, causes and tips', () => {
    const dead = [1, 2, 3, 4, 5, 6].map((id) => plant(id, { damage: 1, health: 0, hydration: 0, waterStress: 1 }));
    const events = [
      ev(2 * DAY + 3600, 'plant.died', 2), // ใส่ไม่เรียงเวลาโดยตั้งใจ
      ev(DAY + 7200, 'plant.water_stress', 2),
      ev(DAY, 'tank.roots_exposed'),
      ev(DAY + 9000, 'plant.wilting', 2),
      ev(3 * DAY, 'plant.died', 1), ev(3 * DAY + 60, 'plant.died', 3),
      ev(-DAY, 'tank.empty'), // รอบก่อน — ต้องไม่ถูกเล่า
    ];
    const story = buildLossStory(
      { lostReason: 'allDead', elapsedS: 3 * DAY + 60, endedAtS: START + 3 * DAY + 60, targetG: 10, timeLimitS: 8 * DAY, deadPlantIds: [1, 2, 3, 4, 5, 6], totalPlants: 6 },
      dead, events, [sample(DAY, { waterLevelPct: 54 })],
    );
    expect(story.lines.map((l) => l.icon)).toEqual(['💧', '😟', '🥀', '💀', '💀']);
    expect(story.lines[0]).toEqual({ when: 'วันที่ 2 · 06:00', icon: '💧', text: expect.stringContaining('54%') });
    expect(story.lines[3]!.text).toBe('ต้นที่ 2 ทนไม่ไหวและตายไป');
    expect(story.lines[4]).toMatchObject({ when: 'วันที่ 4', text: 'ต้นที่ 1, ต้นที่ 3 ตายตามไป' });
    expect(story.causes).toEqual([{ cause: 'water', plants: 6 }]);
    expect(story.tips[0]).toContain('70%');
    expect(story.ending).toContain('ไม่เหลือผัก');
  });

  it('explains a timeout without light as darkness and names the smallest plant weight', () => {
    const alive = [plant(1, { biomassG: 5.4 }), plant(2, { biomassG: 6.1 })];
    const story = buildLossStory(
      { lostReason: 'timeout', elapsedS: 8 * DAY, endedAtS: START + 8 * DAY, targetG: 10, timeLimitS: 8 * DAY, deadPlantIds: [], totalPlants: 2 },
      alive, [], [sample(0, { ppfd: 0 }), sample(DAY, { ppfd: 0 })],
    );
    expect(story.lines[0]).toMatchObject({ when: 'ตลอดรอบ', icon: '🌑' });
    expect(story.causes).toEqual([{ cause: 'dark', plants: 2 }]);
    expect(story.ending).toContain('5.4 g');
    expect(story.ending).toContain('10 g');
  });

  it('describes nutrient stress from EC at that moment', () => {
    const story = buildLossStory(
      { lostReason: 'allDead', elapsedS: DAY, endedAtS: START + DAY, targetG: 10, timeLimitS: null, deadPlantIds: [1], totalPlants: 1 },
      [plant(1, { damage: 1, nutrientStress: 0.9 })], [ev(3600, 'plant.nutrient_stress', 1)], [sample(3600, { ecMsCm: 0.4 })],
    );
    expect(story.lines[0]!.text).toContain('หิวปุ๋ย');
    expect(story.causes[0]!.cause).toBe('nutrient');
    expect(story.tips).toHaveLength(1);
  });

  it('groups a whole-garden death and adds the light tip when LED was never on', () => {
    const dead = [1, 2, 3].map((id) => plant(id, { damage: 1, nutrientStress: 0.9 }));
    const story = buildLossStory(
      { lostReason: 'allDead', elapsedS: DAY, endedAtS: START + DAY, targetG: 10, timeLimitS: null, deadPlantIds: [1, 2, 3], totalPlants: 3 },
      dead, [1, 2, 3].map((id) => ev(DAY - 60, 'plant.died', id)), [sample(0, { ppfd: 0 })],
    );
    expect(story.lines.at(-1)!.text).toBe('ผักทั้ง 3 ต้น ทนไม่ไหวและตายไป');
    expect(story.causes).toEqual([{ cause: 'nutrient', plants: 3 }]);
    expect(story.tips).toHaveLength(2);
    expect(story.tips[1]).toContain('LED');
  });
});
