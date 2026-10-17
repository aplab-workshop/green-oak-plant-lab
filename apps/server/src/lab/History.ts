import type { HistorySample } from '@gol/shared';
import { envEc, levelPct, type Simulation } from '@gol/sim-core';

/** เก็บข้อมูลย้อนหลังทุก intervalS วินาทีจำลอง (ค่าเริ่มต้น 10 นาที, 14 วัน) */
export class History {
  private samples: HistorySample[] = [];
  private nextSampleAt = -Infinity;

  constructor(
    private readonly intervalS = 600,
    private readonly capacity = (14 * 86_400) / 600,
  ) {}

  /** เรียกหลังทุก step — เก็บเมื่อถึงเวลา */
  maybeSample(sim: Simulation): void {
    if (sim.simTimeS < this.nextSampleAt) return;
    this.nextSampleAt = sim.simTimeS + this.intervalS;
    const plants = sim.plants;
    const avg = (f: (p: (typeof plants)[number]) => number) => plants.reduce((s, p) => s + f(p), 0) / Math.max(1, plants.length);
    const env = sim.env;
    this.samples.push({
      simTimeS: sim.simTimeS,
      waterLevelPct: levelPct(env.waterVolumeL, sim.cfg),
      airTempC: env.airTempC,
      rhPct: env.rhPct,
      ppfd: env.ppfd,
      ecMsCm: envEc(env),
      ph: env.ph,
      avgHydration: avg((p) => p.hydration),
      avgWaterStress: avg((p) => p.waterStress),
      avgHealth: avg((p) => p.health),
      avgBiomassG: avg((p) => p.biomassG),
      estimatedOxygen: env.estimatedOxygen,
      plants: plants.map(({ id, biomassG, hydration, waterStress, lightStress, nutrientStress, rootHealth, damage, health }) =>
        ({ id, biomassG, hydration, waterStress, lightStress, nutrientStress, rootHealth, damage, health })),
    });
    if (this.samples.length > this.capacity) this.samples.splice(0, this.samples.length - this.capacity);
  }

  list(): HistorySample[] {
    return this.samples.map((sample) => ({ ...sample, plants: sample.plants.map((p) => ({ ...p })) }));
  }

  clear(): void {
    this.samples = [];
    this.nextSampleAt = -Infinity;
  }
}
