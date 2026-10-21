import { describe, expect, it } from 'vitest';
import { airComfort, isCelebrating, isDaytime, isPlantDead, plantCause, plantMood, showGainBadge } from '../src';

const calm = { waterStress: 0, rootHealth: 1, lightStress: 0, nutrientStress: 0, ppfd: 300, damage: 0 };
const day = { ph: 6.0, minuteOfDay: 600 };

describe('plantMood', () => {
  it('maps health bands and death', () => {
    expect(plantMood({ health: 90, damage: 0 })).toBe('happy');
    expect(plantMood({ health: 85, damage: 0 })).toBe('happy');
    expect(plantMood({ health: 70, damage: 0.1 })).toBe('ok');
    expect(plantMood({ health: 50, damage: 0.2 })).toBe('worried');
    expect(plantMood({ health: 39, damage: 0.4 })).toBe('sick');
    expect(plantMood({ health: 0, damage: 1 })).toBe('dead');
    expect(plantMood({ health: 95, damage: 0 }, true)).toBe('dead');
  });

  it('P45: at night healthy plants sleep 😴, lit plants are tired 🥵, troubled plants keep their face', () => {
    const night = 23 * 60, noon = 12 * 60;
    expect(plantMood({ health: 90, damage: 0, ppfd: 0 }, false, night)).toBe('sleeping');
    expect(plantMood({ health: 70, damage: 0, ppfd: 5 }, false, 3 * 60)).toBe('sleeping');
    expect(plantMood({ health: 90, damage: 0, ppfd: 120 }, false, night)).toBe('tired');
    expect(plantMood({ health: 30, damage: 0.5, ppfd: 120 }, false, night)).toBe('tired');
    expect(plantMood({ health: 50, damage: 0.2, ppfd: 0 }, false, night)).toBe('worried');
    expect(plantMood({ health: 0, damage: 1, ppfd: 120 }, false, night)).toBe('dead');
    expect(plantMood({ health: 90, damage: 0, ppfd: 0 }, false, noon)).toBe('happy');
    expect(plantMood({ health: 90, damage: 0, ppfd: 0 }, false, 6 * 60)).toBe('happy');
    expect(plantMood({ health: 90, damage: 0, ppfd: 0 }, false, 22 * 60)).toBe('sleeping');
  });
});

describe('plantCause', () => {
  it('picks the highest stress at or above 0.25', () => {
    expect(plantCause({ ...calm, waterStress: 0.6, lightStress: 0.3 }, day)).toBe('water');
    expect(plantCause({ ...calm, rootHealth: 0.5, waterStress: 0.3 }, day)).toBe('root');
    expect(plantCause({ ...calm, lightStress: 0.4 }, day)).toBe('light');
    expect(plantCause({ ...calm, waterStress: 0.24 }, day)).toBeNull();
  });
  it('ties follow water → root → light → nutrient', () => {
    expect(plantCause({ ...calm, waterStress: 0.5, rootHealth: 0.5 }, day)).toBe('water');
    expect(plantCause({ ...calm, lightStress: 0.5, nutrientStress: 0.5 }, day)).toBe('light');
  });
  it('splits nutrient stress into pH or EC by the pH ok range', () => {
    expect(plantCause({ ...calm, nutrientStress: 0.5 }, { ...day, ph: 7.2 })).toBe('ph');
    expect(plantCause({ ...calm, nutrientStress: 0.5 }, { ...day, ph: 5.2 })).toBe('ph');
    expect(plantCause({ ...calm, nutrientStress: 0.5 }, { ...day, ph: 6.0 })).toBe('nutrient');
  });
  it('dark only in daytime with low PPFD and no stress; dead plants have no cause', () => {
    expect(plantCause({ ...calm, ppfd: 10 }, day)).toBe('dark');
    expect(plantCause({ ...calm, ppfd: 10 }, { ...day, minuteOfDay: 23 * 60 })).toBeNull();
    expect(plantCause({ ...calm, ppfd: 10, waterStress: 0.5 }, day)).toBe('water');
    expect(plantCause({ ...calm, waterStress: 1, damage: 1 }, day)).toBeNull();
  });
});

describe('time-based badges follow simulated time', () => {
  it('isDaytime is 06:00–22:00', () => {
    expect(isDaytime(359)).toBe(false);
    expect(isDaytime(360)).toBe(true);
    expect(isDaytime(1319)).toBe(true);
    expect(isDaytime(1320)).toBe(false);
  });
  it('gain badge shows 00:00–03:00 once a gain exists', () => {
    expect(showGainBadge({ gainYesterdayG: 2.4 }, 0)).toBe(true);
    expect(showGainBadge({ gainYesterdayG: 2.4 }, 179)).toBe(true);
    expect(showGainBadge({ gainYesterdayG: 2.4 }, 180)).toBe(false);
    expect(showGainBadge({ gainYesterdayG: null }, 10)).toBe(false);
  });
  it('celebrates for 3 simulated hours after a stage change, not when dead', () => {
    const p = { stageChangedAtS: 1000, damage: 0 };
    expect(isCelebrating(p, 1000)).toBe(true);
    expect(isCelebrating(p, 1000 + 3 * 3600 - 1)).toBe(true);
    expect(isCelebrating(p, 1000 + 3 * 3600)).toBe(false);
    expect(isCelebrating({ stageChangedAtS: null, damage: 0 }, 5)).toBe(false);
    expect(isCelebrating({ stageChangedAtS: 1000, damage: 1 }, 1001)).toBe(false);
  });
});

describe('isPlantDead', () => {
  it('uses damage as well as the server dead list', () => {
    expect(isPlantDead({ id: 1, damage: 1 }, [])).toBe(true);
    expect(isPlantDead({ id: 1, damage: 0.3 }, [1])).toBe(true);
    expect(isPlantDead({ id: 1, damage: 0.3 }, [2])).toBe(false);
    expect(isPlantDead({ id: 1, damage: 0.99 })).toBe(false);
  });
});

describe('air comfort and air causes (P33)', () => {
  it('maps VPD to dry / ok / humid', () => {
    expect(airComfort(1.8)).toBe('dry');
    expect(airComfort(1.7)).toBe('ok');
    expect(airComfort(1.0)).toBe('ok');
    expect(airComfort(0.5)).toBe('ok');
    expect(airComfort(0.4)).toBe('humid');
  });
  it('dry air sits after root, humid air after nutrient in tie order', () => {
    expect(plantCause({ ...calm, dryAirStress: 0.4 }, day)).toBe('dryAir');
    expect(plantCause({ ...calm, humidAirStress: 0.4 }, day)).toBe('humidAir');
    expect(plantCause({ ...calm, rootHealth: 0.6, dryAirStress: 0.4 }, day)).toBe('root');
    expect(plantCause({ ...calm, dryAirStress: 0.4, lightStress: 0.4 }, day)).toBe('dryAir');
    expect(plantCause({ ...calm, nutrientStress: 0.4, humidAirStress: 0.4 }, day)).toBe('nutrient');
  });
});

