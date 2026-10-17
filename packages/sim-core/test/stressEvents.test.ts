import { describe, expect, it } from 'vitest';
import { Simulation, envEc, makeConfig } from '../src';
import type { ActuatorCommands } from '@gol/shared';
import { OFF } from './helpers';

describe('Stress events — P13 / AC-27', () => {
  it.each(['light', 'nutrient', 'root'] as const)('%s emits one start and one clear per exposure', (kind) => {
    const sim = new Simulation({ cfg: makeConfig({
      plant: { count: 1 }, room: { tempMeanC: 24, tempAmplitudeC: 0 }, air: { ledHeatC: 0 },
      light: { ppfdMax: kind === 'light' ? 650 : 400, positionFactors: [1] },
      nutrient: { initialEc: kind === 'nutrient' ? 0 : 1.2 },
    }) });
    const run = (h: number, cmd: Partial<ActuatorCommands>) => {
      for (let i = 0; i < Math.round(h * 3600); i++) sim.step(1, { ...OFF, ...cmd });
    };
    run(kind === 'root' ? 24 : 6, { ledPct: kind === 'light' ? 100 : 20, airPump: kind !== 'root' });
    const started = sim.drainEvents().filter((e) => e.kind === `plant.${kind}_stress`);
    expect(started).toHaveLength(1);
    expect(started[0]!.plantId).toBe(1);
    expect(started[0]!.simTimeS).toBeGreaterThan(sim.startTimeS);
    if (kind === 'nutrient') {
      // เติม A+B จน EC ปกติ แล้วหยุด ไม่แก้ State โดยตรง
      for (let i = 0; i < 600 && envEc(sim.env) < 1.2; i++) sim.step(1, { ...OFF, nutrientA: true, nutrientB: true });
      expect(envEc(sim.env)).toBeGreaterThanOrEqual(1.2);
    }
    run(kind === 'light' ? 12 : 48, { ledPct: 20 });
    const after = sim.drainEvents();
    expect(after.filter((e) => e.kind === `plant.${kind}_stress`)).toHaveLength(0);
    expect(after.filter((e) => e.kind === `plant.${kind}_stress_cleared`)).toHaveLength(1);
    sim.reset();
    expect(sim.drainEvents()).toEqual([]);
  });
});
