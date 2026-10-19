import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventEntry, HistorySample, LabSnapshot } from '@gol/shared';
import { eventsForPlant, historyForPlant } from '../src/dashboard/timeline';
import { acceptEvent, acceptSnapshot, useLabStore } from '../src/store/labStore';
import { refreshEvents, refreshHistory } from '../src/store/api';

const sample = (simTimeS: number): HistorySample => ({
  simTimeS, waterLevelPct: 80, airTempC: 25, rhPct: 65, ppfd: 200, ecMsCm: 1.2, ph: 6,
  avgHydration: 0.8, avgWaterStress: 0.2, avgHealth: 90, avgBiomassG: 10, estimatedOxygen: 0.95,
  plants: [1, 2].map((id) => ({ id, biomassG: id * 5, hydration: 0.9, waterStress: 0.1,
    lightStress: id * 0.1, nutrientStress: 0.2, rootHealth: 0.8, damage: 0.05, health: 85 })),
});
const event = (id: number, plantId?: number, runId = 0): EventEntry => ({
  id, plantId, runId, at: 100, simTimeS: id * 3600, kind: 'test', severity: 'info', message: `Event ${id}`,
});
const snapshot = (runId = 0, at = 100, labId = 'lab01'): LabSnapshot => ({
  game: { score: 0, elapsedS: 0, averageHealth: 100, growthProgress: 0, deadPlantIds: [], totalPlants: 0, status: 'playing', endedAtS: null, canHarvest: false, harvestBonus: 0, yieldG: null, testRun: false, targetG: 100, timeLimitS: null, energyKWh: 0, energyBudgetKWh: null, stars: 0, lostReason: null, best: null },
  level: null, levels: [],
  labId, runId, at, simTimeS: 36000, sim: { day: 0, minuteOfDay: 600 }, speed: 360, paused: false,
  plc: { kind: 'mock', mode: 'auto', connection: 'connected', lastOkAt: at, latencyMs: 0, errorCount: 0, lastError: null },
  failsafe: false, commands: { fan: false, humidifier: false, ledPct: 80, refillPump: false,
    nutrientA: false, nutrientB: false, airPump: true, phDown: false },
  sensors: { airTempC: 25, rhPct: 65, ppfd: 200, waterTempC: 24, ph: 6, ecMsCm: 1.2,
    waterLevelPct: 80, flowLpm: 0, powerW: 100, vpdKPa: 1, dli: 5 },
  tank: { waterLevelPct: 80, waterHeightCm: 24, volumeL: 48, capacityL: 60, overflowFlowLpm: 0, heightCm: 30, potBottomCm: 25, estimatedOxygen: 0.95 },
  plants: [], scenario: null, disturbance: { leakLph: 0 }, doses: [],
});
const response = (body: unknown, runId = 0) => new Response(JSON.stringify(body), { headers: { 'X-Lab-Run-Id': String(runId) } });
function deferred() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((r) => { resolve = r; });
  return { promise, resolve };
}

describe('selected plant timeline', () => {
  it('uses the selected plant and inclusive time range, never lab averages', () => {
    const history = [0, 3, 4, 10, 11].map((h) => sample(h * 3600));
    const rows = historyForPlant(history, 1, 10 * 3600, 6);
    expect(rows.map((r) => r.t)).toEqual([4 * 3600, 10 * 3600]);
    expect(rows[0]).toMatchObject({ biomassG: 5, health: 85, lightStress: 10, rootHealth: 80, estimatedOxygen: 95 });
    expect(historyForPlant(history, 2, 10 * 3600, 24)[0]?.biomassG).toBe(10);
    expect(historyForPlant(history, 1, 10 * 3600, 336)).toHaveLength(4);
  });
  it('keeps missing plant samples as gaps and empty history empty', () => {
    expect(historyForPlant([sample(0)], 3, 0, 6)[0]).toMatchObject({ biomassG: null, health: null, lightStress: null });
    expect(historyForPlant([], 1, 0, 24)).toEqual([]);
  });
  it('includes global and selected plant events only within the same window', () => {
    expect(eventsForPlant([event(1), event(4, 1), event(5, 2), event(10), event(11, 1)], 1, 36000, 6)
      .map((e) => e.id)).toEqual([4, 10]);
  });
});

describe('snapshot and REST race protection', () => {
  beforeEach(() => useLabStore.setState({ labId: 'lab01', snapshot: snapshot(), history: [sample(0)], events: [event(1)], viewRevision: 0 }));
  afterEach(() => vi.unstubAllGlobals());

  it('clears data on remote reset and rejects old runs, timestamps, labs and events', () => {
    expect(acceptSnapshot(snapshot(1, 200))).toBe(true);
    expect(useLabStore.getState().history).toEqual([]);
    expect(useLabStore.getState().events).toEqual([]);
    expect(acceptSnapshot(snapshot(0, 300))).toBe(false);
    expect(acceptSnapshot(snapshot(1, 199))).toBe(false);
    expect(acceptSnapshot(snapshot(2, 300, 'lab02'))).toBe(false);
    acceptEvent('lab01', event(2));
    acceptEvent('lab02', event(2, 1, 1));
    acceptEvent('lab01', event(3, 1, 1));
    expect(useLabStore.getState().events.map((e) => e.id)).toEqual([3]);
  });
  it('discards history and events responses started before reset', async () => {
    const h = deferred(), e = deferred();
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(h.promise).mockReturnValueOnce(e.promise));
    const pending = [refreshHistory(), refreshEvents()];
    acceptSnapshot(snapshot(1, 200));
    h.resolve(response([sample(3600)])); e.resolve(response([event(2)]));
    await Promise.all(pending);
    expect(useLabStore.getState().history).toEqual([]);
    expect(useLabStore.getState().events).toEqual([]);
  });
  it('discards responses after switching A to B to A', async () => {
    const h = deferred();
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(h.promise));
    const pending = refreshHistory();
    useLabStore.setState({ labId: 'lab02', viewRevision: 1 });
    useLabStore.setState({ labId: 'lab01', viewRevision: 2, history: [] });
    h.resolve(response([sample(3600)])); await pending;
    expect(useLabStore.getState().history).toEqual([]);
  });
  it('keeps the latest history response when requests finish out of order', async () => {
    const old = deferred(), fresh = deferred();
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise));
    const p1 = refreshHistory(), p2 = refreshHistory();
    fresh.resolve(response([sample(7200)])); await p2;
    old.resolve(response([sample(3600)])); await p1;
    expect(useLabStore.getState().history[0]?.simTimeS).toBe(7200);
  });
  it('rejects a newer server run until its snapshot arrives, then accepts current data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response([sample(0)], 1))
      .mockResolvedValueOnce(response([event(2, 1, 1), event(3, 1, 0)], 1)));
    await refreshHistory();
    expect(useLabStore.getState().history).toEqual([sample(0)]);
    acceptSnapshot(snapshot(1, 200)); await refreshEvents();
    expect(useLabStore.getState().events.map((e) => e.id)).toEqual([2]);
  });
});
