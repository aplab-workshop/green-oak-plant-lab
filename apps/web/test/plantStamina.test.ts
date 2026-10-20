import { describe, expect, it } from 'vitest';
import type { PlantState } from '@gol/shared';
import { isPlantDead, staminaBars } from '../src/dashboard/plantStamina';

const plant = (over: Partial<PlantState> = {}): PlantState => ({
  id: 1, position: 0, ageDays: 14, stage: 'seedling', biomassG: 8, leafCount: 7, leafAreaCm2: 50, rootLengthCm: 6,
  hydration: 1, waterStress: 0, lightStress: 0, nutrientStress: 0, rootHealth: 1, damage: 0, health: 100,
  rootSubmerged: 1, supplyRatio: 1, demandLPerDay: 0.1, ppfd: 300, dliToday: 5, dliYesterday: 12,
  biomassDayStartG: 8, gainYesterdayG: null, stageChangedAtS: null, ...over,
});

const byKey = (p: PlantState, dead = false) => Object.fromEntries(staminaBars(p, dead).map((b) => [b.key, b]));

describe('staminaBars', () => {
  it('shows 6 bars in order where higher is better', () => {
    const bars = staminaBars(plant({ health: 80, hydration: 0.7, nutrientStress: 0.2, lightStress: 0.1, rootHealth: 0.9, damage: 0.05 }), false);
    expect(bars.map((b) => b.key)).toEqual(['health', 'water', 'nutrient', 'light', 'root', 'toughness']);
    expect(bars.map((b) => Number(b.value.toFixed(2)))).toEqual([0.8, 0.7, 0.8, 0.9, 0.9, 0.95]);
  });

  it('warns below 60% (amber) and 30% (red)', () => {
    const b = byKey(plant({ hydration: 0.5, nutrientStress: 0.8, health: 95 }));
    expect(b.water!.level).toBe('low');
    expect(b.water!.color).toBe('#f59e0b');
    expect(b.nutrient!.level).toBe('critical');
    expect(b.nutrient!.color).toBe('#dc2626');
    expect(b.health!.level).toBe('ok');
  });

  it('dead plants grey out every bar', () => {
    expect(staminaBars(plant({ damage: 1, health: 0 }), true).every((b) => b.level === 'dead' && b.color === '#94a3b8')).toBe(true);
  });
});

describe('isPlantDead', () => {
  it('uses damage as well as the server dead list', () => {
    expect(isPlantDead(plant({ damage: 1 }), [])).toBe(true);
    expect(isPlantDead(plant({ damage: 0.3 }), [1])).toBe(true);
    expect(isPlantDead(plant({ damage: 0.3 }), [2])).toBe(false);
  });
});
