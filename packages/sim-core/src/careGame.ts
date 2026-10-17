import type { CareProgress, PlantState } from '@gol/shared';
import type { SimConfig } from './config/defaultConfig';
import { clamp } from './math';

/** คะแนนการดูแลจากเวลาจำลอง ไม่มี Browser/FPS หรือเวลาจริง */
export class CareGame {
  private healthSeconds = 0;
  private progress: CareProgress;
  private readonly initial: number[];
  get lost(): boolean { return this.progress.status === 'lost'; }
  constructor(plants: readonly PlantState[], private readonly cfg: SimConfig) {
    this.initial = plants.map((p) => p.biomassG);
    this.progress = { score: 0, elapsedS: 0, averageHealth: 100, growthProgress: 0,
      deadPlantIds: [], totalPlants: plants.length, status: 'playing', endedAtS: null };
  }
  step(plants: readonly PlantState[], dtS: number, simTimeS: number): void {
    if (this.progress.status === 'lost' || dtS <= 0 || !plants.length) return;
    const elapsedS = this.progress.elapsedS + dtS;
    this.healthSeconds += plants.reduce((sum, p) => sum + p.health, 0) / plants.length * dtS;
    const averageHealth = this.healthSeconds / elapsedS;
    const deadPlantIds = plants.filter((p) => p.damage >= 1).map((p) => p.id);
    const growthProgress = plants.reduce((sum, p, i) => {
      const initial = this.initial[i]!;
      return sum + (p.damage >= 1 ? 0 : clamp((p.biomassG - initial) / Math.max(1, this.cfg.plant.harvestAtG - initial), 0, 1));
    }, 0) / plants.length;
    const alive = 1 - deadPlantIds.length / plants.length;
    const weight = this.cfg.game.healthWeight;
    this.progress = { score: Math.round(this.cfg.game.maxScore * alive *
      (weight * averageHealth / 100 + (1 - weight) * growthProgress)), elapsedS, averageHealth,
      growthProgress, deadPlantIds, totalPlants: plants.length, status: alive === 0 ? 'lost' : 'playing',
      endedAtS: alive === 0 ? simTimeS : null };
  }
  snapshot(): CareProgress { return { ...this.progress, deadPlantIds: [...this.progress.deadPlantIds] }; }
}
