import type { CareProgress, PlantState } from '@gol/shared';
import type { SimConfig } from './config/defaultConfig';
import { clamp } from './math';

/**
 * คะแนนการดูแลจากเวลาจำลอง ไม่มี Browser/FPS หรือเวลาจริง
 * สถานะรอบ ready → playing → won | lost (SPEC § 4.5)
 */
export class CareGame {
  private healthSeconds = 0;
  private progress: CareProgress;
  private readonly initial: number[];
  get lost(): boolean { return this.progress.status === 'lost'; }
  get status(): CareProgress['status'] { return this.progress.status; }
  constructor(plants: readonly PlantState[], private readonly cfg: SimConfig) {
    this.initial = plants.map((p) => p.biomassG);
    this.progress = { score: 0, elapsedS: 0, averageHealth: 100, growthProgress: 0,
      deadPlantIds: [], totalPlants: plants.length, status: 'ready', endedAtS: null,
      canHarvest: false, harvestBonus: 0, yieldG: null, testRun: false };
  }
  /** ready → playing; คืน false ถ้าไม่ได้อยู่ ready */
  start(): boolean {
    if (this.progress.status !== 'ready') return false;
    this.progress = { ...this.progress, status: 'playing' };
    return true;
  }
  /** ติดป้ายรอบ Test (ใช้ Auto ขณะเล่น) — คงไว้จนจบรอบ */
  markTestRun(): void {
    if (this.progress.status === 'playing' && !this.progress.testRun) this.progress = { ...this.progress, testRun: true };
  }
  step(plants: readonly PlantState[], dtS: number, simTimeS: number): void {
    if (this.progress.status !== 'playing' || dtS <= 0 || !plants.length) return;
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
    const canHarvest = alive > 0 && plants.every((p) => p.damage >= 1 || p.biomassG >= this.cfg.plant.harvestAtG);
    this.progress = { ...this.progress, score: Math.round(this.cfg.game.maxScore * alive *
      (weight * averageHealth / 100 + (1 - weight) * growthProgress)), elapsedS, averageHealth,
      growthProgress, deadPlantIds, totalPlants: plants.length, status: alive === 0 ? 'lost' : 'playing',
      endedAtS: alive === 0 ? simTimeS : null, canHarvest: alive === 0 ? false : canHarvest };
  }
  /** เก็บเกี่ยว playing → won เมื่อ canHarvest; คืน false ถ้ายังไม่พร้อม */
  harvest(plants: readonly PlantState[], simTimeS: number): boolean {
    if (this.progress.status !== 'playing' || !this.progress.canHarvest) return false;
    const living = plants.filter((p) => p.damage < 1);
    const alive = living.length / plants.length;
    const harvestBonus = Math.round(this.cfg.game.harvestBonus * alive * this.progress.averageHealth / 100);
    this.progress = { ...this.progress, status: 'won', endedAtS: simTimeS, canHarvest: false, harvestBonus,
      score: this.progress.score + harvestBonus, yieldG: living.reduce((sum, p) => sum + p.biomassG, 0) };
    return true;
  }
  snapshot(): CareProgress { return { ...this.progress, deadPlantIds: [...this.progress.deadPlantIds] }; }
}
