import type { EventEntry, HistorySample } from '@gol/shared';

/** แปลงข้อมูลจาก Server เท่านั้น; ไม่มีการคำนวณ Model ฝั่ง Web */
export function historyForPlant(history: HistorySample[], plantId: number, endS: number, hours: number) {
  return history.filter((h) => h.simTimeS >= endS - hours * 3600 && h.simTimeS <= endS).map((h) => {
    const p = h.plants.find((p) => p.id === plantId);
    return {
      t: h.simTimeS, waterLevelPct: h.waterLevelPct, airTempC: h.airTempC, rhPct: h.rhPct,
      ecMsCm: h.ecMsCm, ph: h.ph, estimatedOxygen: h.estimatedOxygen * 100,
      biomassG: p?.biomassG ?? null, health: p?.health ?? null,
      hydration: p ? p.hydration * 100 : null, waterStress: p ? p.waterStress * 100 : null,
      lightStress: p ? p.lightStress * 100 : null, nutrientStress: p ? p.nutrientStress * 100 : null,
      rootHealth: p ? p.rootHealth * 100 : null, damage: p ? p.damage * 100 : null,
    };
  });
}

export function eventsForPlant(events: EventEntry[], plantId: number, endS: number, hours: number): EventEntry[] {
  return events.filter((e) => (e.plantId === undefined || e.plantId === plantId) &&
    e.simTimeS >= endS - hours * 3600 && e.simTimeS <= endS);
}
