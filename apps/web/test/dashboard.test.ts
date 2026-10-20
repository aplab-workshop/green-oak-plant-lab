import { describe, expect, it } from 'vitest';
import type { EventEntry, PlantState } from '@gol/shared';
import { formatClock, formatDoseRemaining, formatHours, formatSimTime } from '../src/lib/format';
import { challengeLine } from '../src/dashboard/ChallengeCard';
import { sensorStatus } from '../src/dashboard/sensorMeta';
import { leafColor, plantVisuals } from '../src/scene/plantVisuals';
import { mergeEvents } from '../src/store/labStore';
import { pickLab } from '../src/store/wsClient';

const plant = (over: Partial<PlantState> = {}): PlantState => ({
  id: 1,
  position: 0,
  ageDays: 14,
  stage: 'seedling',
  biomassG: 5,
  leafCount: 7,
  leafAreaCm2: 50,
  rootLengthCm: 5.5,
  hydration: 1,
  waterStress: 0,
  lightStress: 0,
  nutrientStress: 0,
  rootHealth: 1,
  damage: 0,
  health: 100,
  rootSubmerged: 1,
  supplyRatio: 1,
  demandLPerDay: 0.1,
  ppfd: 0,
  dliToday: 0,
  dliYesterday: 0,
  lightLoadH: 0,
  dryAirStress: 0,
  humidAirStress: 0,
  growthGPerH: 0,
  growthEfficiency: 0,
  biomassDayStartG: 5,
  gainYesterdayG: null,
  stageChangedAtS: null,
  ...over,
});

describe('format', () => {
  it('formats simulated time', () => {
    expect(formatSimTime(14 * 86_400 + 6 * 3600 + 5 * 60)).toBe('Day 14 · 06:05');
    expect(formatClock(1439)).toBe('23:59');
  });
});

describe('sensorStatus', () => {
  it('classifies values against reference ranges', () => {
    expect(sensorStatus('ph', 6.0)).toBe('ok');
    expect(sensorStatus('ph', 6.8)).toBe('warn');
    expect(sensorStatus('ph', 8.0)).toBe('alarm');
    expect(sensorStatus('waterLevelPct', 50)).toBe('alarm');
    expect(sensorStatus('powerW', 999)).toBe('neutral');
  });
});

describe('plantVisuals', () => {
  it('healthy plant stands upright and green', () => {
    const v = plantVisuals(plant());
    expect(v.droop).toBe(0);
    expect(v.wilted).toBe(false);
    expect(v.scale).toBeCloseTo(1);
    expect(v.leafColor).toBe(leafColor(0, 0));
  });

  it('water stress droops leaves and wilts beyond 0.6', () => {
    expect(plantVisuals(plant({ waterStress: 0.4 })).wilted).toBe(false);
    const v = plantVisuals(plant({ waterStress: 0.8 }));
    expect(v.droop).toBeCloseTo(0.8);
    expect(v.wilted).toBe(true);
    expect(v.leafColor).not.toBe(leafColor(0, 0));
  });

  it('permanent damage keeps leaves drooped after water stress recovers', () => {
    const v = plantVisuals(plant({ waterStress: 0, damage: 0.5 }));
    expect(v.droop).toBeCloseTo(0.4);
    expect(leafColor(0, 0.5)).not.toBe(leafColor(0, 0));
  });

  it('size grows with biomass (cube root)', () => {
    expect(plantVisuals(plant({ biomassG: 40 })).scale).toBeCloseTo(2);
  });

  it('curl follows accumulated light stress and recovery without changing droop', () => {
    const values = [0, 0.5, 1, 0.2, 0].map((lightStress) => plantVisuals(plant({ lightStress })));
    expect(values.map((v) => v.curl)).toEqual([0, 0.5, 1, 0.2, 0]);
    expect(values.every((v) => v.droop === 0)).toBe(true);
    expect(plantVisuals(plant({ ppfd: 2000 }))).toEqual(plantVisuals(plant()));
  });
});

describe('plantVisuals P25 colours', () => {
  it('each stress kind tints leaves differently', () => {
    const colours = [
      leafColor(0, 0),
      leafColor(0.8, 0),
      leafColor(0, 0, 0.8),
      leafColor(0, 0, 0, 0.8),
      leafColor(0, 0.5),
    ];
    expect(new Set(colours).size).toBe(colours.length);
  });

  it('dead plant is dark brown, fully drooped and flagged to fall over', () => {
    const v = plantVisuals(plant({ damage: 1, health: 0 }));
    expect(v.dead).toBe(true);
    expect(v.droop).toBe(1);
    expect(v.leafColor).toBe(leafColor(0, 1));
    expect(plantVisuals(plant()).dead).toBe(false);
  });
});

describe('store helpers', () => {
  const ev = (id: number): EventEntry => ({ id, runId: 0, at: 0, simTimeS: 0, kind: 'k', severity: 'info', message: String(id) });

  it('merges events without duplicates in id order', () => {
    expect(mergeEvents([ev(1), ev(2)], [ev(2), ev(4), ev(3)]).map((e) => e.id)).toEqual([1, 2, 3, 4]);
  });

  it('picks lab from URL, then current, then first', () => {
    expect(pickLab(['lab01', 'lab02'], '?lab=lab02', null)).toBe('lab02');
    expect(pickLab(['lab01', 'lab02'], '?lab=lab09', 'lab02')).toBe('lab02');
    expect(pickLab(['lab01'], '', null)).toBe('lab01');
    expect(pickLab([], '', null)).toBeNull();
  });
});

describe('formatDoseRemaining (P22)', () => {
  it('shows simulated seconds left as m:ss, rounding up', () => {
    expect(formatDoseRemaining(239.4)).toBe('4:00');
    expect(formatDoseRemaining(60)).toBe('1:00');
    expect(formatDoseRemaining(5)).toBe('0:05');
    expect(formatDoseRemaining(-3)).toBe('0:00');
  });
});

describe('challenge countdown (P23)', () => {
  const base = { id: 1, title: '🔥 คลื่นความร้อน', startS: 10_000, endS: 30_000, repaired: false } as const;

  it('formats simulated hours as h:mm', () => {
    expect(formatHours(5.5 * 3600)).toBe('5:30');
    expect(formatHours(59)).toBe('0:01');
    expect(formatHours(-10)).toBe('0:00');
  });

  it('describes warned, active, repaired and finished events', () => {
    expect(challengeLine({ ...base, kind: 'heatWave', status: 'warned' }, 10_000 - 3 * 3600)).toBe('อีก 3:00 ชม.');
    expect(challengeLine({ ...base, kind: 'heatWave', status: 'active' }, 30_000 - 1800)).toBe('เหลือ 0:30 ชม.');
    expect(challengeLine({ ...base, kind: 'leak', status: 'active', endS: null }, 12_000)).toBe('กำลังเกิด — กดซ่อม');
    expect(challengeLine({ ...base, kind: 'leak', status: 'done', repaired: true }, 40_000)).toBe('ซ่อมแล้ว');
    expect(challengeLine({ ...base, kind: 'dryAir', status: 'done' }, 40_000)).toBe('จบแล้ว');
  });
});

