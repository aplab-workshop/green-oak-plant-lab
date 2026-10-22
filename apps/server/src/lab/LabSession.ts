import {
  COMMAND_BITS,
  FAN_COMMAND_REGISTER,
  LED_COMMAND_REGISTER,
  deviceName,
  type ActuatorCommands,
  type LabCommand,
  type LabSnapshot,
  type SensorReadings,
  type CareRecord,
  type LevelId,
  type ActiveDose,
  type DoseDevice,
  type PlayerDevice,
  deviceOfBit,
  playerDeviceOfDose,
  sensorStatus,
  SENSOR_RANGES,
  SENSOR_REGISTERS,
  airComfort,
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
  /** ปลดล็อกทุกด่านตั้งแต่เริ่ม (โหมดผู้พัฒนา, P47 / SPEC § 4.30) */
  unlockAllLevels?: boolean;
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
  COMMAND_BITS.every((bit) => a[bit.key] === b[bit.key]) && a.ledPct === b.ledPct && a.fanPct === b.fanPct;

type BitKey = (typeof COMMAND_BITS)[number]['key'];

/** โดส → Bit ที่เปิด (SPEC § 4.7) */
const DOSE_BITS: Record<DoseDevice, readonly BitKey[]> = {
  refill: ['refillPump'],
  nutrient: ['nutrientA', 'nutrientB'],
  phDown: ['phDown'],
};

const DOSE_LABEL: Record<DoseDevice, string> = {
  refill: 'เติมน้ำ +10% (M102)',
  nutrient: 'ใส่ปุ๋ย 1 โดส (M103+M104)',
  phDown: 'pH Down 1 โดส (M106)',
};

/** โดสของ Bit นี้ (ถ้ามี) */
const doseOfBit = (key: BitKey): DoseDevice | null =>
  key === 'refillPump' ? 'refill' : key === 'nutrientA' || key === 'nutrientB' ? 'nutrient' : key === 'phDown' ? 'phDown' : null;

/** pH ที่ผู้ช่วยฟาร์มสั่ง pH Down 1 โดส (ด่านที่ยังล็อก M106) */
const HELPER_PH_DOWN_ABOVE = 6.6;
/** EC ที่ผู้ช่วยฟาร์มสั่งปุ๋ย 1 โดส (ด่านที่ยังล็อก A+B) — เกณฑ์ล่างของ Ladder ตัวอย่าง */
const HELPER_NUTRIENT_BELOW = 1.0;

/** ค่าที่ Auto-pause ตรวจ "สีแดงครั้งแรก" (SPEC § 4.8) */
type Out = 'low' | 'high';
/** แถบเตือนค่านอกช่วงของด่านแบบแจ้งเตือน — แสดงเฉพาะด่านที่ผู้เล่นคุมอุปกรณ์นั้น (P44 EC, P46 อุณหภูมิ/อากาศ) */
const RANGE_ALERTS: { event: string; device: PlayerDevice; out: (r: SensorReadings) => Out | null; text: (r: SensorReadings, o: Out) => string }[] = [
  {
    event: 'tank.ec_alert', device: 'nutrient',
    out: (r) => outOf(r.ecMsCm, SENSOR_RANGES.ecMsCm!.ok),
    text: (r, o) => o === 'low'
      ? `🧪 EC ${r.ecMsCm.toFixed(2)} ต่ำ ผักหิวปุ๋ย — กด 🧪 ใส่ปุ๋ย`
      : `🧪 EC ${r.ecMsCm.toFixed(2)} เข้มเกิน — เติมน้ำ 🚰 เจือจาง และหยุดใส่ปุ๋ย`,
  },
  {
    event: 'air.temp_alert', device: 'fan',
    out: (r) => outOf(r.airTempC, SENSOR_RANGES.airTempC!.ok),
    text: (r, o) => o === 'high'
      ? `🌡️ ร้อน ${r.airTempC.toFixed(1)} °C — เร่ง 🌀 พัดลม หรือลดไฟ LED`
      : `🌡️ เย็น ${r.airTempC.toFixed(1)} °C — หรี่ 🌀 พัดลม`,
  },
  {
    event: 'air.vpd_alert', device: 'humidifier',
    out: (r) => { const c = airComfort(r.vpdKPa); return c === 'dry' ? 'high' : c === 'humid' ? 'low' : null; },
    text: (r, o) => o === 'high'
      ? `💨 อากาศแห้ง (VPD ${r.vpdKPa.toFixed(1)} kPa) — เปิด 🌫️ หมอก`
      : `💦 อากาศชื้นจัด (VPD ${r.vpdKPa.toFixed(1)} kPa) — ปิด 🌫️ หมอก`,
  },
];
const outOf = (v: number, [lo, hi]: readonly [number, number]): Out | null => (v < lo ? 'low' : v > hi ? 'high' : null);

const RED_WATCH = ['waterLevelPct', 'ecMsCm', 'ph', 'airTempC', 'rhPct'] as const;
/** P37: หยุดเกมเฉพาะค่าที่ผู้เล่นแก้ได้ด้วยอุปกรณ์ที่ด่านปลดล็อก */
const RED_WATCH_DEVICE: Record<(typeof RED_WATCH)[number], PlayerDevice> = {
  waterLevelPct: 'refillPump', ecMsCm: 'nutrient', ph: 'phDown', airTempC: 'fan', rhPct: 'humidifier',
};

/** คำสั่งที่มีผลระหว่างไฟดับ (แสดงใน Snapshot) */
const OUTAGE_COMMANDS: Readonly<ActuatorCommands> = Object.freeze({
  fanPct: 0, humidifier: false, ledPct: 0, refillPump: false, nutrientA: false, nutrientB: false, airPump: false, phDown: false,
});

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
  private readonly devUnlockAll: boolean;
  /** โดสที่ค้าง นับเวลาจำลองราย Step (SPEC § 4.7) */
  private readonly doses = new Map<DoseDevice, ActiveDose>();
  /** ผู้ช่วยหยุดเกม (SPEC § 4.8) */
  private autoPauseEnabled = true;
  private autoPauseReason: string | null = null;
  /** ค่าที่เคยแดงแล้วในรอบนี้ (หยุดครั้งแรกครั้งเดียวต่อค่า) */
  private readonly redSeen = new Set<string>();
  /** P37: ค่าที่แดงอยู่แล้วตอนเริ่มรอบ (เช่นด่าน 1 เริ่มถังว่าง) — ไม่หยุดเกมจนกว่าค่าจะกลับมาไม่แดงก่อน */
  private readonly redAtStart = new Set<string>();
  /** P43: น้ำเคยถึง waterAlertPct แล้วในรอบนี้ (ตอนเริ่มถังว่างยังไม่แจ้ง) */
  private waterReached = false;
  /** P43: น้ำต่ำกว่า waterAlertPct อยู่ → แถบแจ้งเตือน (ไม่หยุดเกม) */
  private waterLow = false;
  /** P44/P46: ค่าที่นอกช่วงอยู่ (Event kind ของกฎ → low/high) ในด่านแบบแจ้งเตือน */
  private readonly rangeOut = new Map<string, 'low' | 'high'>();
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
    this.devUnlockAll = opts.unlockAllLevels ?? false;
    if (this.devUnlockAll) for (const l of LEVELS) this.unlocked.add(l.id);
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
    const result = this.clock.advance(realElapsedMs, (dt) => {
      // โดสซ้อนบนคำสั่งจริงเฉพาะ Step ที่ยังเหลือเวลา → ผลเท่ากันทุก Speed / ทุกการแบ่ง Tick
      // ไฟดับ: ปั๊มไม่ทำงาน โดสจึงหยุดนับเวลาไว้ก่อน (SPEC § 4.8)
      const outage = this.sim.powerOutage;
      this.sim.step(dt, this.effectiveCommands());
      if (!outage) this.consumeDoses(dt);
      this.history.maybeSample(this.sim);
    });
    if (result.lagged && this.now() - this.lastLagLogAt > 10_000) {
      this.lastLagLogAt = this.now();
      this.log('sim.lagged', 'warning', 'Server คำนวณไม่ทัน เวลาจำลองช้ากว่าที่ตั้งไว้');
    }
    this.drainSimEvents();
    this.checkAlerts();
    this.checkRedValues();
  }

  private drainSimEvents(): void {
    for (const e of this.sim.drainEvents()) {
      if (e.kind === 'game.over' || e.kind === 'game.won') {
        this.saveRecord();
        // P39: เก็บเกี่ยวอัตโนมัติ/จบรอบใน Step → หยุดเวลาเหมือนกดเก็บเกี่ยวเอง
        this.clock.pause();
      }
      this.events.add({ at: this.now(), ...e });
      if (e.kind === 'challenge.warning' || e.kind === 'challenge.start') this.autoPause(e.message);
    }
  }

  /** Auto-pause ใช้เฉพาะโหมดด่านขณะกำลังเล่น — ด่านแบบแจ้งเตือน (waterAlertPct) ไม่หยุดเกมเลย (P43/P44) */
  private get autoPauseActive(): boolean {
    return this.autoPauseEnabled && this.level !== null && this.level.waterAlertPct === null && this.sim.game.status === 'playing';
  }

  private autoPause(reason: string): void {
    if (!this.autoPauseActive) return;
    this.autoPauseReason = reason;
    if (this.clock.paused) return;
    this.clock.pause();
    this.log('game.autopause', 'warning', 'ผู้ช่วยหยุดเกมให้: ' + reason);
  }

  /**
   * ด่านแบบแจ้งเตือน: น้ำ < waterAlertPct (P43) และค่านอกช่วงของอุปกรณ์ที่ผู้เล่นคุม — EC (P44), อุณหภูมิ/อากาศ (P46)
   * → แถบแจ้งเตือน + Event log ครั้งละหนึ่งครั้งต่อการออกนอกช่วง (ไม่หยุดเกม)
   */
  private checkAlerts(): void {
    const lim = this.level?.waterAlertPct ?? null;
    if (lim === null || this.sim.game.status !== 'playing') {
      this.waterLow = false;
      this.rangeOut.clear();
      return;
    }
    const r = this.sim.readSensors(false);
    if (r.waterLevelPct >= lim) {
      this.waterReached = true;
      this.waterLow = false;
    } else if (this.waterReached && !this.waterLow) {
      this.waterLow = true;
      this.log('tank.low_water', 'warning', this.waterAlertText(r.waterLevelPct, lim));
    }
    for (const rule of RANGE_ALERTS) {
      const out = this.level?.playerDevices.includes(rule.device) ? rule.out(r) : null;
      if (out && out !== this.rangeOut.get(rule.event)) this.log(rule.event, 'warning', rule.text(r, out));
      if (out) this.rangeOut.set(rule.event, out);
      else this.rangeOut.delete(rule.event);
    }
  }

  private waterAlertText(w: number, lim: number): string {
    return `💧 น้ำเหลือ ${Math.floor(w)}% ต่ำกว่า ${lim}% — เปิด 🚰 เติมน้ำ`;
  }

  private alerts(r: SensorReadings): string[] {
    const lim = this.level?.waterAlertPct ?? null;
    if (lim === null) return [];
    const out: string[] = [];
    if (this.waterLow) out.push(this.waterAlertText(r.waterLevelPct, lim));
    for (const rule of RANGE_ALERTS) {
      const o = this.rangeOut.get(rule.event);
      if (o) out.push(rule.text(r, o));
    }
    return out;
  }

  /** ค่าสีแดงครั้งแรกในรอบ → Auto-pause */
  private checkRedValues(): void {
    if (!this.autoPauseActive) return;
    const r = this.sim.readSensors(false);
    const lim = this.level?.waterAlertPct ?? null;
    for (const key of RED_WATCH) {
      if (this.level && !this.level.playerDevices.includes(RED_WATCH_DEVICE[key])) continue;
      if (key === 'waterLevelPct' && lim !== null) continue;
      const red = sensorStatus(key, r[key]) === 'alarm';
      if (this.redAtStart.has(key)) {
        if (!red) this.redAtStart.delete(key);
        continue;
      }
      if (this.redSeen.has(key) || !red) continue;
      this.redSeen.add(key);
      const reg = SENSOR_REGISTERS.find((x) => x.key === key)!;
      this.autoPause(`${reg.label} เป็นสีแดง (${r[key].toFixed(key === 'ph' || key === 'ecMsCm' ? 2 : 1)} ${reg.unit})`);
      return;
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

  /** คำสั่งที่ Simulation ใช้จริง = คำสั่งจาก PLC/ผู้ช่วย + โดสที่ค้าง */
  private effectiveCommands(): ActuatorCommands {
    if (this.sim.powerOutage) return OUTAGE_COMMANDS;
    if (this.doses.size === 0) return this.applied;
    const out = { ...this.applied };
    for (const d of this.doses.keys()) for (const bit of DOSE_BITS[d]) out[bit] = true;
    return out;
  }

  private doseDurationS(device: DoseDevice): number {
    const d = this.sim.cfg.dose;
    return device === 'refill' ? d.refillS : device === 'nutrient' ? d.nutrientS : d.phDownS;
  }

  /** เพิ่มโดสเข้าคิว (กดซ้ำ = ต่อเวลา) — คืน false ถ้าเกินจำนวนค้างสูงสุด */
  private startDose(device: DoseDevice, by: 'player' | 'helper'): boolean {
    const per = this.doseDurationS(device);
    const cur = this.doses.get(device);
    if (cur && cur.remainingS + per > per * this.sim.cfg.dose.maxQueued + 1e-9) return false;
    if (cur) {
      cur.remainingS += per;
      cur.totalS += per;
    } else this.doses.set(device, { device, remainingS: per, totalS: per });
    this.log('dose.start', 'info', (by === 'helper' ? 'ผู้ช่วยฟาร์ม: ' : '') + DOSE_LABEL[device] + ' — ' + per + ' s จำลอง');
    return true;
  }

  private consumeDoses(dtS: number): void {
    for (const [device, dose] of this.doses) {
      dose.remainingS -= dtS;
      if (dose.remainingS <= 1e-9) {
        this.doses.delete(device);
        this.log('dose.done', 'info', DOSE_LABEL[device] + ' เสร็จ');
      }
    }
  }

  private clearDoses(reason: string): void {
    if (this.doses.size === 0) return;
    this.doses.clear();
    this.log('dose.cancel', 'warning', 'ยกเลิกโดสที่ค้าง: ' + reason);
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
      this.clearDoses('Fail-safe');
    }

    let next = this.failsafe || !this.lastCommands ? { ...FAILSAFE_COMMANDS } : { ...this.lastCommands };
    if (this.level && !this.failsafe) {
      next = applyFarmHelper(next, this.applied, this.lastSensors, this.level.playerDevices, this.level.lockedMode);
      // Nutrient / pH Down ที่ล็อก: ผู้ช่วยสั่งครั้งละ 1 โดส (นับเวลาจำลอง) แทนการเปิดค้างระหว่างรอบ Poll
      // P37: ด่านที่ล็อกแบบ 'off' ไม่มีโดสผู้ช่วย
      const lockedDevice = (d: 'nutrient' | 'phDown') => this.level!.lockedMode === 'helper' && !this.level!.playerDevices.includes(d);
      if (lockedDevice('nutrient') && this.lastSensors.ecMsCm < HELPER_NUTRIENT_BELOW && !this.doses.has('nutrient')) {
        this.startDose('nutrient', 'helper');
      }
      if (lockedDevice('phDown') && this.lastSensors.ph > HELPER_PH_DOWN_ABOVE && !this.doses.has('phDown')) {
        this.startDose('phDown', 'helper');
      }
    }
    if (!sameCommands(next, this.applied)) this.logActuatorChanges(this.applied, next);
    this.applied = next;
  }

  private logActuatorChanges(prev: ActuatorCommands, next: ActuatorCommands): void {
    for (const bit of COMMAND_BITS) {
      if (prev[bit.key] !== next[bit.key]) {
        this.log('actuator.change', 'info', `${bit.label} (${deviceName('M', bit.address)}): ${next[bit.key] ? 'ON' : 'OFF'}`);
      }
    }
    for (const reg of [LED_COMMAND_REGISTER, FAN_COMMAND_REGISTER]) {
      if (prev[reg.key] !== next[reg.key]) {
        this.log('actuator.change', 'info', `${reg.label} (${deviceName('D', reg.address)}): ${next[reg.key]}%`);
      }
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
        this.autoPauseReason = null;
        this.log('sim.resume', 'info', 'เดิน Simulation ต่อ');
        return;
      }
      case 'startGame':
        if (!this.sim.startGame()) throw new LabCommandError('เริ่มได้เฉพาะรอบที่ยังไม่เริ่ม — Reset เพื่อเริ่มรอบใหม่', 409);
        if (this.usingAuto) this.sim.markTestRun();
        {
          const r = this.sim.readSensors(false);
          for (const key of RED_WATCH) if (sensorStatus(key, r[key]) === 'alarm') this.redAtStart.add(key);
        }
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
        this.clearDoses('เปลี่ยนโหมด PLC เป็น ' + cmd.mode);
        this.log('plc.mode', 'info', `Mock PLC mode: ${cmd.mode}`);
        await this.poll();
        return;
      case 'setManualBit':
        if (this.level && !this.level.playerDevices.includes(deviceOfBit(cmd.key))) {
          throw new LabCommandError('อุปกรณ์นี้ยังไม่ปลดล็อกในด่านนี้ — ผู้ช่วยฟาร์มดูแลให้', 409);
        }
        this.manual().setManualBit(cmd.key, cmd.value);
        {
          // สั่ง Bit เองระหว่างโดส = ยกเลิกโดสนั้นแล้วใช้ค่าที่สั่ง
          const dosed = doseOfBit(cmd.key);
          if (dosed && this.doses.delete(dosed)) this.log('dose.cancel', 'info', 'ยกเลิก' + DOSE_LABEL[dosed] + ' — สั่งเองด้วย Manual');
        }
        await this.poll();
        return;
      case 'setManualFan':
        if (this.level && !this.level.playerDevices.includes('fan')) {
          throw new LabCommandError('ด่านนี้ยังไม่ปลดล็อกพัดลม', 409);
        }
        this.manual().setManualFan(cmd.value);
        await this.poll();
        return;
      case 'setManualLed':
        this.manual().setManualLed(cmd.value);
        await this.poll();
        return;
      case 'repairLeak':
        if (!this.sim.repairLeak()) throw new LabCommandError('ตอนนี้ไม่มีถังรั่วให้ซ่อม', 409);
        this.drainSimEvents();
        return;
      case 'setAutoPause':
        this.autoPauseEnabled = cmd.enabled;
        if (!cmd.enabled) this.autoPauseReason = null;
        this.log('game.autopause_setting', 'info', cmd.enabled ? 'เปิดผู้ช่วยหยุดเกม' : 'ปิดผู้ช่วยหยุดเกม');
        return;
      case 'dose': {
        this.manual();
        if (this.failsafe) throw new LabCommandError('อยู่ใน Fail-safe — สั่งโดสไม่ได้จนกว่า PLC จะกลับมา', 409);
        if (this.level && !this.level.playerDevices.includes(playerDeviceOfDose(cmd.device))) {
          throw new LabCommandError('อุปกรณ์นี้ยังไม่ปลดล็อกในด่านนี้ — ผู้ช่วยฟาร์มดูแลให้', 409);
        }
        if (!this.startDose(cmd.device, 'player')) {
          throw new LabCommandError('โดสค้างได้สูงสุด ' + this.sim.cfg.dose.maxQueued + ' ครั้ง — รอให้โดสก่อนหน้าทำงานก่อน', 409);
        }
        return;
      }
    }
  }

  /** Reset Lab นี้ (FR-42) — ใช้ Scenario เดิมถ้ามี ไม่กระทบ Lab อื่น */
  reset(saveRecord = true, round?: RoundStart): void {
    if (saveRecord) this.saveRecord();
    this.doses.clear();
    this.redSeen.clear();
    this.redAtStart.clear();
    this.waterReached = false;
    this.waterLow = false;
    this.rangeOut.clear();
    this.autoPauseReason = null;
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

  /** คำสั่งที่ใช้จริง (รวมโดสที่ค้าง) */
  get commands(): Readonly<ActuatorCommands> {
    return this.effectiveCommands();
  }
  get isFailsafe(): boolean {
    return this.failsafe;
  }

  snapshot(): LabSnapshot {
    const s = this.sim.snapshot();
    const cfg = this.sim.cfg;
    const commands = { ...this.effectiveCommands() };
    return {
      game: { ...this.sim.game, best: this.bestByScenario.has(this.recordKey)
        ? { ...this.bestByScenario.get(this.recordKey)! } : null },
      level: this.level ? levelInfo(this.level) : null,
      devUnlockAll: this.devUnlockAll,
      levels: LEVELS.map((l) => ({ ...levelInfo(l), unlocked: this.unlocked.has(l.id), bestStars: this.bestStars.get(l.id) ?? 0 })),
      labId: this.labId,
      runId: this.events.runId,
      at: this.now(),
      simTimeS: s.simTimeS,
      sim: this.sim.readSimInfo(),
      speed: this.clock.speed,
      paused: this.clock.paused,
      plc: this.adapter.status(),
      failsafe: this.failsafe,
      commands,
      sensors: { ...this.lastSensors },
      tank: {
        waterLevelPct: levelPct(s.env.waterVolumeL, cfg),
        waterHeightCm: waterHeightCm(s.env.waterVolumeL, cfg),
        volumeL: s.env.waterVolumeL,
        capacityL: cfg.tank.capacityL,
        overflowFlowLpm: commands.refillPump ? s.env.overflowFlowLpm : 0,
        leakLph: this.sim.totalLeakLph,
        heightCm: cfg.tank.heightCm,
        potBottomCm: cfg.tank.potBottomCm,
        estimatedOxygen: s.env.estimatedOxygen,
      },
      plants: s.plants,
      scenario: this.scenario
        ? { id: this.scenario.id, title: this.scenario.title, objective: this.scenario.objective, description: this.scenario.description }
        : null,
      disturbance: s.disturbance,
      doses: [...this.doses.values()].map((d) => ({ ...d })),
      challenges: this.sim.challengeViews(),
      alerts: this.alerts(this.sim.readSensors(false)),
      mascot: this.sim.mascot,
      autoPause: { enabled: this.autoPauseEnabled, reason: this.autoPauseReason },
    };
  }
}
