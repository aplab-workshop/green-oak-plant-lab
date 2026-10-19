import type { ActuatorCommands, SensorReadings, SimInfo } from '@gol/shared';
import { DEFAULT_CONFIG, type SimConfig } from './config/defaultConfig';
import { simTimeFrom } from './clock';
import { clamp, vpdKPa } from './math';
import { Rng } from './rng';
import type { SimEvent } from './events';
import {
  envEc,
  initialEnvironment,
  stepEnvironment,
  type EnvironmentState,
} from './environment/environment';
import { levelPct, waterHeightCm } from './environment/tank';
import { createPlant, plantWaterRequest, stepPlant, type PlantEnvironment, type PlantState } from './plant/plant';
import { rootSupplyRatio } from './plant/water';
import { readSensors, readSimInfo } from './sensors';
import { CareGame, type Mission } from './careGame';
import { powerW } from './environment/power';

export interface Disturbance {
  /** น้ำรั่วออกจากถัง (L/h) */
  leakLph: number;
}

export interface SimulationOptions {
  cfg?: SimConfig;
  /** Seed สำหรับความแปรปรวนของต้นและ Sensor noise */
  seed?: number;
}

export interface SimulationSnapshot {
  simTimeS: number;
  env: EnvironmentState;
  plants: PlantState[];
  disturbance: Disturbance;
}

interface PlantFlags {
  dead: boolean;
  stressed: boolean;
  wilting: boolean;
  damageLevel: number;
  light: boolean;
  nutrient: boolean;
  root: boolean;
}

/** จุดเริ่มของรอบตามด่าน (SPEC § 4.6) — ว่าง = Free Play ตาม Config */
export interface RoundStart {
  initialBiomassG?: number;
  startDay?: number;
  mission?: Mission;
}

/**
 * Simulation — รวม Environment + Plants + Sensors ของ 1 Lab (Pure, ไม่มี I/O)
 * เวลาเดินผ่าน step(dt, commands) เท่านั้น
 */
export class Simulation {
  readonly cfg: SimConfig;
  private readonly seed: number;
  private noiseRng!: Rng;
  private _simTimeS = 0;
  private _env!: EnvironmentState;
  private _plants: PlantState[] = [];
  private care!: CareGame;
  get game() { return this.care.snapshot(); }
  private flags: PlantFlags[] = [];
  private rootsExposed = false;
  private overflowing = false;
  private empty = false;
  private events: SimEvent[] = [];
  disturbance: Disturbance = { leakLph: 0 };
  private round: RoundStart = {};

  constructor(opts: SimulationOptions = {}) {
    this.cfg = opts.cfg ?? DEFAULT_CONFIG;
    this.seed = opts.seed ?? 1;
    this.reset();
  }

  get simTimeS(): number {
    return this._simTimeS;
  }
  get env(): Readonly<EnvironmentState> {
    return this._env;
  }
  get plants(): readonly Readonly<PlantState>[] {
    return this._plants;
  }

  /** เวลาเริ่มต้นตาม Config (หรือตามด่านของรอบนี้) */
  get startTimeS(): number {
    return simTimeFrom(this.round.startDay ?? this.cfg.time.startDay, this.cfg.time.startHour);
  }

  /** กลับสู่สภาวะเริ่มต้น (Deterministic ตาม seed); round = จุดเริ่มของด่าน (คงไว้จนส่งค่าใหม่) */
  reset(round?: RoundStart): void {
    if (round) this.round = round;
    const cfg = this.cfg;
    this._simTimeS = this.startTimeS;
    this._env = initialEnvironment(cfg, this._simTimeS);
    const growthRng = new Rng(this.seed);
    this.noiseRng = new Rng(this.seed + 0x9e3779b9);
    const { count, initialBiomassSpread } = cfg.plant;
    const initialBiomassG = this.round.initialBiomassG ?? cfg.plant.initialBiomassG;
    this._plants = Array.from({ length: count }, (_, i) => {
      const variation = 1 + initialBiomassSpread * (2 * growthRng.next() - 1);
      return createPlant(i + 1, i, initialBiomassG * variation, this._simTimeS, cfg);
    });
    this.flags = this._plants.map(() => ({ dead: false, stressed: false, wilting: false, damageLevel: 0, light: false, nutrient: false, root: false }));
    this.care = new CareGame(this._plants, cfg, this.round.mission);
    this.rootsExposed = false;
    this.overflowing = false;
    this.empty = false;
    this.events = [];
    this.disturbance = { leakLph: 0 };
  }

  /** เริ่มรอบเกม ready → playing (SPEC § 4.5) */
  startGame(): boolean {
    return this.care.start();
  }

  /** เก็บเกี่ยว playing → won เมื่อต้นที่รอดทุกต้นถึง harvestAtG */
  harvest(): boolean {
    const ok = this.care.harvest(this._plants, this._simTimeS);
    if (ok) this.emitWon();
    return ok;
  }

  private emitWon(): void {
    const g = this.care.snapshot();
    this.emit({ kind: 'game.won', severity: 'info', message: `เก็บเกี่ยวสำเร็จ — ผลผลิต ${g.yieldG!.toFixed(0)} g, คะแนน ${g.score} (โบนัส ${g.harvestBonus}), ${'⭐'.repeat(g.stars)}` });
  }

  /** ติดป้ายรอบ Test (Auto ถูกใช้ขณะเล่น) */
  markTestRun(): void {
    this.care.markTestRun();
  }

  /** ตั้งระดับน้ำ (Initial condition ของ Scenario) โดยคง EC เดิม */
  setWaterLevelPct(pct: number): void {
    const ec = envEc(this._env);
    const volume = (clamp(pct, 0, 100) / 100) * this.cfg.tank.capacityL;
    this._env = { ...this._env, waterVolumeL: volume, saltMass: ec * volume };
  }

  /** ตั้ง pH ของสารละลาย (Initial condition ของ Scenario/Event) clamp ตาม Config */
  setPh(ph: number): void {
    this._env = { ...this._env, ph: clamp(ph, this.cfg.nutrient.phMin, this.cfg.nutrient.phMax) };
  }

  /** เดิน Simulation 1 step */
  step(dtS: number, cmd: ActuatorCommands): void {
    const cfg = this.cfg;
    const env = this._env;
    const ledPct = clamp(Number.isFinite(cmd.ledPct) ? cmd.ledPct : 0, 0, 100);
    const plantEnv: PlantEnvironment = {
      simTimeS: this._simTimeS,
      waterHeightCm: waterHeightCm(env.waterVolumeL, cfg),
      ledPct,
      airTempC: env.airTempC,
      vpdKPa: vpdKPa(env.airTempC, env.rhPct),
      ecMsCm: envEc(env),
      ph: env.ph,
      estimatedOxygen: env.estimatedOxygen,
    };

    // 1) พืชขอน้ำตามความต้องการและรากที่แช่น้ำ
    const requests = this._plants.map((p) => plantWaterRequest(p, plantEnv, cfg));
    const requestedL = requests.reduce((sum, r) => sum + (r.demandLPerDay * r.supplyRatio * dtS) / 86_400, 0);

    // 2) ถังจ่ายน้ำได้จริงเท่าไร
    const result = stepEnvironment(
      env,
      { cmd, simTimeS: this._simTimeS, plantUptakeDemandL: requestedL, leakLph: this.disturbance.leakLph },
      dtS,
      cfg,
    );
    const tankFactor = requestedL > 0 ? result.uptakeL / requestedL : env.waterVolumeL > 0 ? 1 : 0;

    // 3) อัปเดตต้นไม้
    this._plants = this._plants.map((p, i) => stepPlant(p, requests[i]!, plantEnv, tankFactor, dtS, cfg));
    this._env = result.state;
    this._simTimeS += dtS;
    const wasPlaying = this.care.status === 'playing';
    this.care.step(this._plants, dtS, this._simTimeS, powerW(cmd, cfg));
    if (wasPlaying && this.care.lost) {
      this.emit({ kind: 'game.over', severity: 'critical', message: this.care.snapshot().lostReason === 'timeout'
        ? 'Game Over — หมดเวลาของด่าน ผักยังไม่ถึงเป้าหมาย'
        : 'Game Over — ต้นไม้ตายครบทุกต้น เริ่มรอบใหม่เพื่อปลูกอีกครั้ง' });
    }
    if (wasPlaying && this.care.status === 'won') this.emitWon();

    this.detectEvents(env, result.state);
  }

  readSensors(withNoise = true): SensorReadings {
    return readSensors(this._env, this.cfg, withNoise ? this.noiseRng : undefined);
  }

  readSimInfo(): SimInfo {
    return readSimInfo(this._simTimeS);
  }

  /** ดึง Event ที่เกิดขึ้นตั้งแต่ครั้งก่อน */
  drainEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** สำเนาของ State (ปลอดภัยต่อการส่งออกนอก Simulation) */
  snapshot(): SimulationSnapshot {
    return {
      simTimeS: this._simTimeS,
      env: { ...this._env },
      plants: this._plants.map((p) => ({ ...p })),
      disturbance: { ...this.disturbance },
    };
  }

  private emit(e: Omit<SimEvent, 'simTimeS'>): void {
    this.events.push({ simTimeS: this._simTimeS, ...e });
  }

  private detectEvents(before: EnvironmentState, after: EnvironmentState): void {
    const cfg = this.cfg;

    this._plants.forEach((p, i) => {
      const f = this.flags[i]!;
      const name = `Plant ${p.id}`;
      if (p.damage >= 1 && !f.dead) {
        f.dead = true;
        this.emit({ kind: 'plant.died', severity: 'critical', plantId: p.id, message: `${name}: ตายแล้ว (Damage 100%)` });
      }
      if (!f.stressed && p.waterStress >= cfg.events.stressOn) {
        f.stressed = true;
        this.emit({
          kind: 'plant.water_stress',
          severity: 'warning',
          plantId: p.id,
          message: `${name}: เกิด Water stress (รากแช่น้ำ ${Math.round(p.rootSubmerged * 100)}%)`,
        });
      } else if (f.stressed && p.waterStress <= cfg.events.stressOff) {
        f.stressed = false;
        this.emit({ kind: 'plant.water_stress_cleared', severity: 'info', plantId: p.id, message: `${name}: Water stress ลดลง ฟื้นตัวแล้ว` });
      }
      const wilting = p.waterStress >= cfg.plant.damageStressThreshold;
      if (wilting && !f.wilting) {
        this.emit({ kind: 'plant.wilting', severity: 'critical', plantId: p.id, message: `${name}: ใบเหี่ยว เริ่มเกิดความเสียหายถาวร` });
      }
      f.wilting = wilting;
      for (const [key, stress, label] of [
        ['light', p.lightStress, 'Light'], ['nutrient', p.nutrientStress, 'Nutrient'], ['root', 1 - p.rootHealth, 'Root'],
      ] as const) {
        if (!f[key] && stress >= cfg.events.stressOn) {
          f[key] = true;
          this.emit({ kind: `plant.${key}_stress`, severity: 'warning', plantId: p.id,
            message: `${name}: ${label} stress เกินเกณฑ์ (${Math.round(stress * 100)}%)` });
        } else if (f[key] && stress <= cfg.events.stressOff) {
          f[key] = false;
          this.emit({ kind: `plant.${key}_stress_cleared`, severity: 'info', plantId: p.id,
            message: `${name}: ${label} stress ลดลง (${Math.round(stress * 100)}%)` });
        }
      }
      const level = cfg.events.damageLevels.filter((d) => p.damage >= d).length;
      if (level > f.damageLevel) {
        f.damageLevel = level;
        this.emit({
          kind: 'plant.damage',
          severity: 'critical',
          plantId: p.id,
          message: `${name}: Damage สะสม ${Math.round(p.damage * 100)}% (ไม่สามารถฟื้นคืนได้)`,
        });
      }
    });

    // Root Health ต่ำทำให้ Uptake ลดได้ทั้งที่น้ำถึงราก จึงตรวจเฉพาะเรขาคณิต
    const exposed = this._plants.some((p) => rootSupplyRatio(p.rootSubmerged, cfg) < 1);
    if (exposed && !this.rootsExposed) {
      this.emit({ kind: 'tank.roots_exposed', severity: 'warning', message: `ระดับน้ำ ${levelPct(after.waterVolumeL, cfg).toFixed(0)}%: รากบางต้นพ้นน้ำ` });
    } else if (!exposed && this.rootsExposed) {
      this.emit({ kind: 'tank.roots_covered', severity: 'info', message: 'รากทุกต้นแช่น้ำเพียงพอแล้ว' });
    }
    this.rootsExposed = exposed;

    const overflowing = after.totalOverflowL > before.totalOverflowL;
    if (overflowing && !this.overflowing) {
      this.emit({ kind: 'tank.overflow', severity: 'warning', message: 'น้ำล้นถัง: Refill Pump ยังทำงานขณะถังเต็ม' });
    }
    this.overflowing = overflowing;

    const empty = after.waterVolumeL <= 0;
    if (empty && !this.empty) this.emit({ kind: 'tank.empty', severity: 'critical', message: 'ถังน้ำแห้ง' });
    this.empty = empty;
  }
}
