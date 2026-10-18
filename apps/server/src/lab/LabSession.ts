import {
  COMMAND_BITS,
  LED_COMMAND_REGISTER,
  deviceName,
  type ActuatorCommands,
  type LabCommand,
  type LabSnapshot,
  type SensorReadings,
  type CareRecord,
  type LevelId,
  deviceOfBit,
} from '@gol/shared';
import {
  LEVELS, SimClock, Simulation, findLevel, levelInfo, levelPct, levelRound, waterHeightCm,
  type LevelDef, type RoundStart, type SimulationOptions,
} from '@gol/sim-core';
import { applyFarmHelper } from './farmHelper';
import { FAILSAFE_COMMANDS } from '../plc/failsafe';
import { MockPlcAdapter } from '../plc/MockPlcAdapter';
import { nextHeartbeat, type PlcAdapter } from '../plc/PlcAdapter';
import { findScenario, type Scenario } from '../scenarios/scenarios';
import { SimulatedSensorProvider, type SensorProvider } from '../sensors/SensorProvider';
import { EventLog } from './EventLog';
import { History } from './History';

export interface LabSessionOptions {
  labId: string;
  adapter: PlcAdapter;
  sim?: SimulationOptions;
  /** Command เก่ากว่านี้ (ms เวลาจริง) → Fail-safe */
  commandTimeoutMs?: number;
  sensorNoise?: boolean;
  /** นาฬิกาเวลาจริง (inject ได้สำหรับ Test) */
  now?: () => number;
  /** true = ข้ามหน้า Ready และเริ่มรอบทันทีทุกครั้งที่ Reset (ใช้ใน Test/สคริปต์) */
  autoStart?: boolean;
  /** ด่านเริ่มต้น (SPEC § 4.6) — ค่าเริ่มต้น Free Play */
  level?: LevelId | 'free';
}

export class LabCommandError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

const sameCommands = (a: ActuatorCommands, b: ActuatorCommands) =>
  COMMAND_BITS.every((bit) => a[bit.key] === b[bit.key]) && a.ledPct === b.ledPct;

/**
 * LabSession — 1 Lab ที่แยกอิสระ (FR-40): Simulation, Clock, PLC adapter, Event log, History ของตัวเอง
 *
 * วงจร PLC-in-the-loop:
 *   tick(): Clock → Simulation.step(dt, effectiveCommands)
 *   poll(): writeSensors(D100–D112, D120) → readCommands(M100–M105, D200)
 *   Command หมดอายุ → Fail-safe (FR-32)
 */
export class LabSession {
  readonly labId: string;
  readonly sim: Simulation;
  readonly clock: SimClock;
  readonly events = new EventLog();
  readonly history = new History();
  readonly adapter: PlcAdapter;
  private readonly provider: SensorProvider;
  private readonly now: () => number;
  private readonly commandTimeoutMs: number;

  private lastCommands: ActuatorCommands | null = null;
  private lastCommandAt: number | null = null;
  private applied: ActuatorCommands = { ...FAILSAFE_COMMANDS };
  private failsafe = true;
  private everReceived = false;
  private lastSensors: SensorReadings;
  private heartbeat = 0;
  private polling: Promise<void> | null = null;
  private commErrorActive = false;
  private lastClampKey = '';
  private scenario: Scenario | null = null;
  private lastLagLogAt = -Infinity;
  private readonly bestByScenario = new Map<string, CareRecord>();
  private readonly autoStart: boolean;
  private level: LevelDef | null = null;
  private readonly unlocked = new Set<LevelId>(['L1']);
  private readonly bestStars = new Map<LevelId, number>();

  private get recordKey(): string {
    return this.level?.id ?? this.scenario?.id ?? 'free';
  }

  private saveRecord(): void {
    const game = this.sim.game;
    if (game.testRun) return;
    if (this.level && game.status === 'won') {
      this.bestStars.set(this.level.id, Math.max(game.stars, this.bestStars.get(this.level.id) ?? 0));
      const next = LEVELS[LEVELS.findIndex((l) => l.id === this.level!.id) + 1];
      if (next) this.unlocked.add(next.id);
    }
    const key = this.recordKey;
    const best = this.bestByScenario.get(key);
    if ((game.status === 'won' || game.elapsedS >= this.sim.cfg.game.recordMinS) && (!best || game.score > best.score)) {
      this.bestByScenario.set(key, { score: game.score, elapsedS: game.elapsedS });
    }
  }

  constructor(opts: LabSessionOptions) {
    this.labId = opts.labId;
    this.adapter = opts.adapter;
    this.now = opts.now ?? Date.now;
    this.commandTimeoutMs = opts.commandTimeoutMs ?? 3000;
    this.autoStart = opts.autoStart ?? false;
    this.sim = new Simulation(opts.sim);
    if (opts.level && opts.level !== 'free') {
      this.level = findLevel(opts.level);
      this.sim.reset(levelRound(this.level));
    }
    this.clock = new SimClock({
      startS: this.sim.startTimeS,
      dtS: this.sim.cfg.time.dtS,
      maxStepsPerTick: this.sim.cfg.time.maxStepsPerTick,
    });
    this.provider = new SimulatedSensorProvider(this.sim, opts.sensorNoise ?? true);
    this.lastSensors = this.provider.read();
    this.history.maybeSample(this.sim);
    this.enterRound();
  }

  /** รอบใหม่: autoStart เริ่มทันที มิฉะนั้นรอ startGame โดยหยุดเวลาไว้ (SPEC § 4.5) */
  private enterRound(): void {
    if (this.autoStart) {
      this.sim.startGame();
      this.clock.resume();
    } else this.clock.pause();
  }

  private get usingAuto(): boolean {
    return this.adapter instanceof MockPlcAdapter && this.adapter.mode === 'auto';
  }

  /** เดินเวลาจำลองตามเวลาจริงที่ผ่านไป */
  tick(realElapsedMs: number): void {
    this.updateCommandState();
    if (this.usingAuto) this.sim.markTestRun();
    const cmd = this.applied;
    const result = this.clock.advance(realElapsedMs, (dt) => {
      this.sim.step(dt, cmd);
      this.history.maybeSample(this.sim);
    });
    if (result.lagged && this.now() - this.lastLagLogAt > 10_000) {
      this.lastLagLogAt = this.now();
      this.log('sim.lagged', 'warning', 'Server คำนวณไม่ทัน เวลาจำลองช้ากว่าที่ตั้งไว้');
    }
    this.drainSimEvents();
  }

  private drainSimEvents(): void {
    for (const e of this.sim.drainEvents()) {
      if (e.kind === 'game.over' || e.kind === 'game.won') this.saveRecord();
      this.events.add({ at: this.now(), ...e });
    }
  }

  /** 1 รอบการสื่อสารกับ PLC (ไม่ซ้อนกัน) */
  poll(): Promise<void> {
    if (!this.polling) {
      this.polling = this.doPoll().finally(() => {
        this.polling = null;
      });
    }
    return this.polling;
  }

  private async doPoll(): Promise<void> {
    try {
      const sensors = this.provider.read();
      this.lastSensors = sensors;
      this.heartbeat = nextHeartbeat(this.heartbeat);
      const { clamped } = await this.adapter.writeSensors({ sensors, sim: this.sim.readSimInfo(), heartbeat: this.heartbeat });
      const clampKey = clamped.join(',');
      if (clampKey && clampKey !== this.lastClampKey) {
        this.log('sensor.out_of_range', 'warning', `ค่า Sensor เกินช่วง Register ถูก Clamp: ${clamped.join(', ')}`);
      }
      this.lastClampKey = clampKey;

      const read = await this.adapter.readCommands();
      if (read.outOfRange.length) this.log('command.out_of_range', 'warning', `คำสั่งเกินช่วงถูก Clamp: ${read.outOfRange.join(', ')}`);
      this.lastCommands = read.commands;
      this.lastCommandAt = read.at;
      if (this.commErrorActive) {
        this.commErrorActive = false;
        this.log('plc.comm_restored', 'info', 'สื่อสารกับ PLC ได้อีกครั้ง');
      }
    } catch (err) {
      if (!this.commErrorActive) {
        this.commErrorActive = true;
        this.log('plc.comm_error', 'critical', `สื่อสารกับ PLC ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    this.updateCommandState();
  }

  /** ตรวจอายุ Command → เลือกคำสั่งที่ใช้จริง และบันทึกการเปลี่ยนสถานะ Actuator */
  private updateCommandState(): void {
    const fresh = this.lastCommandAt !== null && this.now() - this.lastCommandAt <= this.commandTimeoutMs;
    if (fresh && this.failsafe) {
      this.failsafe = false;
      this.log(
        'plc.commands_active',
        'info',
        this.everReceived ? 'ออกจาก Fail-safe: กลับมาใช้คำสั่งจาก PLC' : 'เริ่มรับคำสั่ง Actuator จาก PLC',
      );
      this.everReceived = true;
    } else if (!fresh && !this.failsafe) {
      this.failsafe = true;
      this.log(
        'plc.failsafe',
        'critical',
        `ไม่ได้รับคำสั่งจาก PLC เกิน ${this.commandTimeoutMs / 1000} วินาที → Fail-safe (ปิดทุกอย่าง ยกเว้น Air Pump)`,
      );
    }

    let next = this.failsafe || !this.lastCommands ? { ...FAILSAFE_COMMANDS } : { ...this.lastCommands };
    if (this.level && !this.failsafe) next = applyFarmHelper(next, this.applied, this.lastSensors, this.level.playerDevices);
    if (!sameCommands(next, this.applied)) this.logActuatorChanges(this.applied, next);
    this.applied = next;
  }

  private logActuatorChanges(prev: ActuatorCommands, next: ActuatorCommands): void {
    for (const bit of COMMAND_BITS) {
      if (prev[bit.key] !== next[bit.key]) {
        this.log('actuator.change', 'info', `${bit.label} (${deviceName('M', bit.address)}): ${next[bit.key] ? 'ON' : 'OFF'}`);
      }
    }
    if (prev.ledPct !== next.ledPct) {
      this.log('actuator.change', 'info', `${LED_COMMAND_REGISTER.label} (${deviceName('D', LED_COMMAND_REGISTER.address)}): ${next.ledPct}%`);
    }
  }

  private log(kind: string, severity: 'info' | 'warning' | 'critical', message: string): void {
    this.events.add({ at: this.now(), simTimeS: this.sim.simTimeS, kind, severity, message });
  }

  /** รับคำสั่งจาก UI/API */
  async handle(cmd: LabCommand): Promise<void> {
    switch (cmd.type) {
      case 'setSpeed':
        this.clock.setSpeed(cmd.speed);
        this.log('sim.speed', 'info', `Simulation speed: ${cmd.speed}x`);
        return;
      case 'pause':
        this.clock.pause();
        this.log('sim.pause', 'info', 'หยุด Simulation ชั่วคราว');
        return;
      case 'resume': {
        const status = this.sim.game.status;
        if (status === 'ready') throw new LabCommandError('กด Start เพื่อเริ่มรอบก่อน', 409);
        if (status === 'won') throw new LabCommandError('เก็บเกี่ยวแล้ว — Reset เพื่อเริ่มรอบใหม่', 409);
        this.clock.resume();
        this.log('sim.resume', 'info', 'เดิน Simulation ต่อ');
        return;
      }
      case 'startGame':
        if (!this.sim.startGame()) throw new LabCommandError('เริ่มได้เฉพาะรอบที่ยังไม่เริ่ม — Reset เพื่อเริ่มรอบใหม่', 409);
        if (this.usingAuto) this.sim.markTestRun();
        this.clock.resume();
        this.log('game.start', 'info', 'เริ่มปลูก — ดูแลผักให้โตจนเก็บเกี่ยวได้');
        return;
      case 'harvest':
        if (!this.sim.harvest()) throw new LabCommandError('ยังเก็บเกี่ยวไม่ได้ — ต้นที่รอดทุกต้นต้องโตถึงน้ำหนักเก็บเกี่ยว', 409);
        this.clock.pause();
        this.drainSimEvents();
        return;
      case 'reset':
        this.reset();
        return;
      case 'applyScenario': {
        const s = findScenario(cmd.scenarioId);
        if (!s) throw new LabCommandError(`ไม่พบ Scenario ${cmd.scenarioId}`, 404);
        this.saveRecord();
        this.scenario = s;
        this.level = null;
        this.reset(false, {});
        return;
      }
      case 'clearScenario':
        this.saveRecord();
        this.scenario = null;
        this.reset(false);
        return;
      case 'selectLevel': {
        if (cmd.levelId !== 'free' && !this.unlocked.has(cmd.levelId)) throw new LabCommandError('ด่านนี้ยังล็อกอยู่ — ผ่านด่านก่อนหน้าก่อน', 409);
        this.saveRecord();
        this.scenario = null;
        this.level = cmd.levelId === 'free' ? null : findLevel(cmd.levelId);
        this.reset(false, this.level ? levelRound(this.level) : {});
        return;
      }
      case 'setPlcMode':
        this.mock().setMode(cmd.mode);
        this.log('plc.mode', 'info', `Mock PLC mode: ${cmd.mode}`);
        await this.poll();
        return;
      case 'setManualBit':
        if (this.level && !this.level.playerDevices.includes(deviceOfBit(cmd.key))) {
          throw new LabCommandError('อุปกรณ์นี้ยังไม่ปลดล็อกในด่านนี้ — ผู้ช่วยฟาร์มดูแลให้', 409);
        }
        this.manual().setManualBit(cmd.key, cmd.value);
        await this.poll();
        return;
      case 'setManualLed':
        this.manual().setManualLed(cmd.value);
        await this.poll();
        return;
    }
  }

  /** Reset Lab นี้ (FR-42) — ใช้ Scenario เดิมถ้ามี ไม่กระทบ Lab อื่น */
  reset(saveRecord = true, round?: RoundStart): void {
    if (saveRecord) this.saveRecord();
    this.sim.reset(round);
    this.clock.reset(this.sim.startTimeS);
    this.history.clear();
    this.events.clear();
    if (this.scenario) this.scenario.apply(this.sim);
    this.sim.drainEvents();
    this.lastSensors = this.provider.read();
    this.history.maybeSample(this.sim);
    this.enterRound();
    this.log('lab.reset', 'info', this.scenario ? `Reset Lab และเริ่ม Scenario: ${this.scenario.title}`
      : this.level ? `เริ่มด่าน ${this.level.id}: ${this.level.title}` : 'Reset Lab สู่สภาวะเริ่มต้น (Free Play)');
  }

  private mock(): MockPlcAdapter {
    if (!(this.adapter instanceof MockPlcAdapter)) throw new LabCommandError('คำสั่งนี้ใช้ได้กับ Mock PLC เท่านั้น', 409);
    return this.adapter;
  }

  private manual(): MockPlcAdapter {
    const m = this.mock();
    if (m.mode !== 'manual') throw new LabCommandError('สั่ง Actuator เองได้เฉพาะ Mock PLC โหมด manual', 409);
    return m;
  }

  get commands(): Readonly<ActuatorCommands> {
    return this.applied;
  }
  get isFailsafe(): boolean {
    return this.failsafe;
  }

  snapshot(): LabSnapshot {
    const s = this.sim.snapshot();
    const cfg = this.sim.cfg;
    return {
      game: { ...this.sim.game, best: this.bestByScenario.has(this.recordKey)
        ? { ...this.bestByScenario.get(this.recordKey)! } : null },
      level: this.level ? levelInfo(this.level) : null,
      levels: LEVELS.map((l) => ({ id: l.id, title: l.title, unlocked: this.unlocked.has(l.id), bestStars: this.bestStars.get(l.id) ?? 0 })),
      labId: this.labId,
      runId: this.events.runId,
      at: this.now(),
      simTimeS: s.simTimeS,
      sim: this.sim.readSimInfo(),
      speed: this.clock.speed,
      paused: this.clock.paused,
      plc: this.adapter.status(),
      failsafe: this.failsafe,
      commands: { ...this.applied },
      sensors: { ...this.lastSensors },
      tank: {
        waterLevelPct: levelPct(s.env.waterVolumeL, cfg),
        waterHeightCm: waterHeightCm(s.env.waterVolumeL, cfg),
        volumeL: s.env.waterVolumeL,
        capacityL: cfg.tank.capacityL,
        overflowFlowLpm: this.applied.refillPump ? s.env.overflowFlowLpm : 0,
        heightCm: cfg.tank.heightCm,
        potBottomCm: cfg.tank.potBottomCm,
        estimatedOxygen: s.env.estimatedOxygen,
      },
      plants: s.plants,
      scenario: this.scenario
        ? { id: this.scenario.id, title: this.scenario.title, objective: this.scenario.objective, description: this.scenario.description }
        : null,
      disturbance: s.disturbance,
    };
  }
}
