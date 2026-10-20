import { z } from 'zod';
import type { ActuatorCommands, PlantState, SensorReadings, SimInfo } from './types';

/** โหมดของ PLC adapter */
export type PlcAdapterKind = 'mock' | 'slmp';
/** โหมดของ Mock PLC: manual = กดสั่งจาก UI, auto = Logic ตัวอย่าง, offline = จำลองสายหลุด */
export type MockPlcMode = 'manual' | 'auto' | 'offline';
export type PlcConnection = 'connecting' | 'connected' | 'offline' | 'error';

export interface PlcStatus {
  kind: PlcAdapterKind;
  connection: PlcConnection;
  /** โหมด Mock (เฉพาะ kind = mock) */
  mode?: MockPlcMode;
  /** เวลาจริงที่สื่อสารสำเร็จล่าสุด (ms epoch) */
  lastOkAt: number | null;
  /** เวลาตอบสนองของรอบล่าสุด (ms) */
  latencyMs: number | null;
  errorCount: number;
  lastError: string | null;
}

export type EventSeverity = 'info' | 'warning' | 'critical';

/** รายการใน Event Log ของ Lab */
export interface EventEntry {
  id: number;
  /** รอบการทดลอง เพิ่มเมื่อ Reset */
  runId: number;
  /** เวลาจริง (ms epoch) */
  at: number;
  simTimeS: number;
  kind: string;
  severity: EventSeverity;
  message: string;
  plantId?: number;
}

/** ข้อมูลย้อนหลังสำหรับกราฟ (สุ่มเก็บทุก 10 นาทีจำลอง) */
export type PlantHistorySample = Pick<PlantState,
  'id' | 'biomassG' | 'hydration' | 'waterStress' | 'lightStress' | 'nutrientStress' | 'rootHealth' | 'damage' | 'health'>;

export interface HistorySample {
  simTimeS: number;
  waterLevelPct: number;
  airTempC: number;
  rhPct: number;
  ppfd: number;
  ecMsCm: number;
  ph: number;
  avgHydration: number;
  avgWaterStress: number;
  avgHealth: number;
  avgBiomassG: number;
  /** Estimated Oxygen Status [0,1] ไม่ใช่ DO */
  estimatedOxygen: number;
  plants: PlantHistorySample[];
}

export interface ScenarioInfo {
  id: string;
  title: string;
  objective: string;
  description: string;
}

export interface CareProgress {
  score: number;
  elapsedS: number;
  averageHealth: number;
  growthProgress: number;
  /** ความคืบหน้าสู่การเก็บเกี่ยว 0–1 = ต่ำสุดของต้นที่รอด (B − B₀)/(เป้า − B₀) — P35 */
  harvestProgress: number;
  deadPlantIds: number[];
  totalPlants: number;
  /** ready = รอกด Start, playing = กำลังดูแล, won = เก็บเกี่ยวแล้ว, lost = ตายครบ (SPEC § 4.5) */
  status: GameStatus;
  endedAtS: number | null;
  /** ต้นที่รอดทุกต้นถึง harvestAtG และรอดอย่างน้อย 1 ต้น */
  canHarvest: boolean;
  /** โบนัสเก็บเกี่ยว (points) — 0 จนกว่าจะชนะ */
  harvestBonus: number;
  /** Biomass รวมของต้นที่รอด ณ ตอนเก็บเกี่ยว (g) */
  yieldG: number | null;
  /** รอบนี้เคยใช้ Mock PLC Auto ขณะเล่น → เป็นรอบ Test ไม่นับ Best */
  testRun: boolean;
  /** เป้าหมายน้ำหนักต่อต้นของรอบนี้ (g) — Free Play = harvestAtG */
  targetG: number;
  /** เวลาจำกัดของด่าน (s จำลอง) — null = ไม่จำกัด */
  timeLimitS: number | null;
  /** พลังงานไฟฟ้าสะสมขณะเล่น (kWh) */
  energyKWh: number;
  /** งบไฟของด่าน (kWh) — null = ไม่มีงบ */
  energyBudgetKWh: number | null;
  /** ดาวเมื่อชนะ 1–3 (0 = ยังไม่ชนะ) */
  stars: number;
  /** น้ำที่ล้นถังขณะเล่น (L) — P29 */
  overflowL: number;
  /** พลังงาน Refill Pump ที่ใช้ขณะน้ำล้น (kWh) — รวมอยู่ใน energyKWh แล้ว */
  overflowKWh: number;
  /** คะแนนที่ถูกหักจากน้ำล้น (points) */
  overflowPenalty: number;
  lostReason: 'allDead' | 'timeout' | null;
}

export const LEVEL_IDS = ['L1', 'L2', 'L3', 'L4'] as const;
export type LevelId = (typeof LEVEL_IDS)[number];
/** อุปกรณ์ที่ผู้เล่นคุมได้ในแต่ละด่าน (nutrient = Pump A+B) */
export type PlayerDevice = 'led' | 'refillPump' | 'nutrient' | 'fan' | 'humidifier' | 'airPump' | 'phDown';

/** Bit ของ Actuator → อุปกรณ์ผู้เล่น (Nutrient A/B รวมเป็นปุ่มเดียว) */
export const deviceOfBit = (key: 'fan' | 'humidifier' | 'refillPump' | 'nutrientA' | 'nutrientB' | 'airPump' | 'phDown'): PlayerDevice =>
  key === 'nutrientA' || key === 'nutrientB' ? 'nutrient' : key;

/** อุปกรณ์ที่สั่งเป็นโดสได้ (SPEC § 4.7) */
export const DOSE_DEVICES = ['refill', 'nutrient', 'phDown'] as const;
export type DoseDevice = (typeof DOSE_DEVICES)[number];

/** โดส → อุปกรณ์ผู้เล่น (ใช้ตรวจการปลดล็อกในด่าน) */
export const playerDeviceOfDose = (d: DoseDevice): PlayerDevice => (d === 'refill' ? 'refillPump' : d);

/** เหตุการณ์ท้าทาย (SPEC § 4.8) */
export type ChallengeKind = 'heatWave' | 'leak' | 'powerOutage' | 'dryAir' | 'alkalineTap';

/** เหตุการณ์ที่ผู้เล่นเห็น (ถูกเตือนแล้ว) */
export interface ChallengeView {
  id: number;
  kind: ChallengeKind;
  title: string;
  status: 'warned' | 'active' | 'done';
  /** เวลาจำลองที่เริ่ม (s) */
  startS: number;
  /** เวลาจำลองที่จบ — null = จนกว่าจะซ่อม */
  endS: number | null;
  repaired: boolean;
  /** กดซ่อมได้หรือไม่ (ถังรั่วที่ไม่หยุดเอง) — P37: รั่วในด่าน 1 หยุดเอง ซ่อมไม่ได้ */
  repairable: boolean;
}

/** โดสที่กำลังทำงานหรือรอคิว (เวลาจำลอง) */
export interface ActiveDose {
  device: DoseDevice;
  remainingS: number;
  totalS: number;
}

export interface LevelInfo {
  id: LevelId;
  title: string;
  description: string;
  targetG: number;
  /** Biomass เริ่มต้นต่อต้นของด่าน (g) ก่อนสุ่ม ± — P31 */
  startBiomassG: number;
  timeLimitDays: number;
  energyBudgetKWh: number;
  playerDevices: PlayerDevice[];
  /** อุปกรณ์ที่ล็อก: 'off' = ปิดสนิท (ด่าน 1, P37) · 'helper' = ผู้ช่วยฟาร์มคุมให้ */
  lockedMode: 'off' | 'helper';
  /** ปัจจัยที่ไม่มีผลต่อผักในด่านนี้ (ผู้เล่นคุมไม่ได้) — P38 */
  ignoredFactors: PlantFactor[];
}

/** ปัจจัยสิ่งแวดล้อมที่ด่านเลือกไม่นับผลต่อผักได้ (P38 / SPEC § 4.21) */
export type PlantFactor = 'temperature' | 'air' | 'nutrient';

/** สถานะด่านใน Snapshot — รวมรายละเอียดด่านเพื่อให้หน้าเลือกด่านไม่ต้องเก็บค่าซ้ำ (P24) */
export interface LevelProgress extends LevelInfo { unlocked: boolean; bestStars: number }

export type GameStatus = 'ready' | 'playing' | 'won' | 'lost';

export interface CareRecord { score: number; elapsedS: number }

export interface LabSnapshot {
  game: CareProgress & { best: CareRecord | null };
  /** ด่านปัจจุบัน — null = Free Play */
  level: LevelInfo | null;
  levels: LevelProgress[];
  labId: string;
  runId: number;
  /** เวลาจริงที่สร้าง Snapshot (ms epoch) */
  at: number;
  simTimeS: number;
  sim: SimInfo;
  speed: number;
  paused: boolean;
  plc: PlcStatus;
  /** true = ใช้ Fail-safe เพราะ Command หมดอายุ */
  failsafe: boolean;
  /** คำสั่งที่ Simulation ใช้อยู่จริง (หลังพิจารณา Fail-safe) */
  commands: ActuatorCommands;
  /** ค่า Sensor ที่ส่งให้ PLC รอบล่าสุด */
  sensors: SensorReadings;
  tank: {
    waterLevelPct: number;
    waterHeightCm: number;
    volumeL: number;
    capacityL: number;
    /** อัตราน้ำล้นจริงจาก Model (L/min); ไม่ใช่ PLC sensor */
    overflowFlowLpm: number;
    heightCm: number;
    potBottomCm: number;
    /** Estimated Oxygen Status [0,1] ไร้หน่วย ไม่ใช่ Sensor DO */
    estimatedOxygen: number;
  };
  plants: PlantState[];
  scenario: ScenarioInfo | null;
  disturbance: { leakLph: number };
  /** โดสที่ค้างอยู่ (SPEC § 4.7) */
  doses: ActiveDose[];
  /** เหตุการณ์ที่เตือนแล้ว/กำลังเกิด/จบแล้วในรอบนี้ (SPEC § 4.8) */
  challenges: ChallengeView[];
  /** ผู้ช่วยหยุดเกม — reason = เหตุผลที่หยุดล่าสุด (ล้างเมื่อ Resume) */
  autoPause: { enabled: boolean; reason: string | null };
}

export const SPEED_VALUES = [1, 60, 360, 1440, 3600] as const;

const ActuatorBitKey = z.enum(['fan', 'humidifier', 'refillPump', 'nutrientA', 'nutrientB', 'airPump', 'phDown']);

/** คำสั่งที่ Client ส่งมาที่ POST /api/labs/:labId/commands */
export const LabCommand = z.discriminatedUnion('type', [
  z.object({ type: z.literal('setSpeed'), speed: z.union([z.literal(1), z.literal(60), z.literal(360), z.literal(1440), z.literal(3600)]) }),
  z.object({ type: z.literal('pause') }),
  z.object({ type: z.literal('resume') }),
  z.object({ type: z.literal('reset') }),
  z.object({ type: z.literal('startGame') }),
  z.object({ type: z.literal('harvest') }),
  z.object({ type: z.literal('selectLevel'), levelId: z.enum(['L1', 'L2', 'L3', 'L4', 'free']) }),
  z.object({ type: z.literal('setPlcMode'), mode: z.enum(['manual', 'auto', 'offline']) }),
  z.object({ type: z.literal('setManualBit'), key: ActuatorBitKey, value: z.boolean() }),
  z.object({ type: z.literal('setManualLed'), value: z.number().int().min(0).max(100) }),
  z.object({ type: z.literal('dose'), device: z.enum(DOSE_DEVICES) }),
  z.object({ type: z.literal('repairLeak') }),
  z.object({ type: z.literal('setAutoPause'), enabled: z.boolean() }),
  z.object({ type: z.literal('applyScenario'), scenarioId: z.string().min(1).max(64) }),
  z.object({ type: z.literal('clearScenario') }),
]);
export type LabCommand = z.infer<typeof LabCommand>;
