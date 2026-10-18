import type { CareProgress, PlantState } from '@gol/shared';
import type { SimConfig } from './config/defaultConfig';
import { clamp } from './math';

/** เป้าหมายของรอบ (SPEC § 4.6) — ไม่ส่ง = Free Play */
export interface Mission {
  /** น้ำหนักเป้าหมายต่อต้น (g) */
  targetG: number;
  /** เวลาจำกัด (s จำลอง) — null = ไม่จำกัด */
  timeLimitS: number | null;
  /** งบไฟ (kWh) — null = ไม่มีงบ */
  energyBudgetKWh: number | null;
}

/**
 * คะแนนการดูแลจากเวลาจำลอง ไม่มี Browser/FPS หรือเวลาจริง
 * สถานะรอบ ready → playing → won | lost (SPEC § 4.5–4.6)
 */
export class CareGame {
  private healthSeconds = 0;
  private progress: CareProgress;
  private readonly initial: number[];
  get lost(): boolean { return this.progress.status === 'lost'; }
  get status(): CareProgress['status'] { return this.progress.status; }
  constructor(plants: readonly PlantState[], private readonly cfg: SimConfig, mission?: Mission) {
    this.initial = plants.map((p) => p.biomassG);
    this.progress = { score: 0, elapsedS: 0, averageHealth: 100, growthProgress: 0,
      deadPlantIds: [], totalPlants: plants.length, status: 'ready', endedAtS: null,
      canHarvest: false, harvestBonus: 0, yieldG: null, testRun: false,
      targetG: mission?.targetG ?? cfg.plant.harvestAtG, timeLimitS: mission?.timeLimitS ?? null,
      energyKWh: 0, energyBudgetKWh: mission?.energyBudgetKWh ?? null, stars: 0, lostReason: null };
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
  step(plants: readonly PlantState[], dtS: number, simTimeS: number, powerW = 0): void {
    if (this.progress.status !== 'playing' || dtS <= 0 || !plants.length) return;
    const { targetG } = this.progress;
    const elapsedS = this.progress.elapsedS + dtS;
    this.healthSeconds += plants.reduce((sum, p) => sum + p.health, 0) / plants.length * dtS;
    const averageHealth = this.healthSeconds / elapsedS;
    const deadPlantIds = plants.filter((p) => p.damage >= 1).map((p) => p.id);
    const growthProgress = plants.reduce((sum, p, i) => {
      const initial = this.initial[i]!;
      return sum + (p.damage >= 1 ? 0 : clamp((p.biomassG - initial) / Math.max(1, targetG - initial), 0, 1));
    }, 0) / plants.length;
    const alive = 1 - deadPlantIds.length / plants.length;
    const weight = this.cfg.game.healthWeight;
    const canHarvest = alive > 0 && plants.every((p) => p.damage >= 1 || p.biomassG >= targetG);
    this.progress = { ...this.progress, score: Math.round(this.cfg.game.maxScore * alive *
      (weight * averageHealth / 100 + (1 - weight) * growthProgress)), elapsedS, averageHealth,
      growthProgress, deadPlantIds, totalPlants: plants.length, status: alive === 0 ? 'lost' : 'playing',
      endedAtS: alive === 0 ? simTimeS : null, canHarvest: alive === 0 ? false : canHarvest,
      energyKWh: this.progress.energyKWh + powerW * dtS / 3_600_000, lostReason: alive === 0 ? 'allDead' : null };
    const limit = this.progress.timeLimitS;
    if (this.progress.status === 'playing' && limit !== null && elapsedS >= limit && !this.harvest(plants, simTimeS)) {
      this.progress = { ...this.progress, score: 0, status: 'lost', endedAtS: simTimeS, canHarvest: false, lostReason: 'timeout' };
    }
  }
  /** เก็บเกี่ยว playing → won เมื่อ canHarvest; คืน false ถ้ายังไม่พร้อม */
  harvest(plants: readonly PlantState[], simTimeS: number): boolean {
    if (this.progress.status !== 'playing' || !this.progress.canHarvest) return false;
    const living = plants.filter((p) => p.damage < 1);
    const alive = living.length / plants.length;
    const { averageHealth, energyKWh, energyBudgetKWh } = this.progress;
    const harvestBonus = Math.round(this.cfg.game.harvestBonus * alive * averageHealth / 100);
    const stars = 1 + (alive === 1 ? 1 : 0) +
      (averageHealth >= this.cfg.game.starHealthPct && (energyBudgetKWh === null || energyKWh <= energyBudgetKWh) ? 1 : 0);
    this.progress = { ...this.progress, status: 'won', endedAtS: simTimeS, canHarvest: false, harvestBonus, stars,
      score: this.progress.score + harvestBonus, yieldG: living.reduce((sum, p) => sum + p.biomassG, 0) };
    return true;
  }
  snapshot(): CareProgress { return { ...this.progress, deadPlantIds: [...this.progress.deadPlantIds] }; }
}
