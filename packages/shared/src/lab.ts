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
  /** เวลาจริง (ms epoch) */
  at: number;
  simTimeS: number;
  kind: string;
  severity: EventSeverity;
  message: string;
  plantId?: number;
}

/** ข้อมูลย้อนหลังสำหรับกราฟ (สุ่มเก็บทุก 10 นาทีจำลอง) */
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
}

export interface ScenarioInfo {
  id: string;
  title: string;
  objective: string;
  description: string;
}

export interface LabSnapshot {
  labId: string;
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
    heightCm: number;
    potBottomCm: number;
  };
  plants: PlantState[];
  scenario: ScenarioInfo | null;
  disturbance: { leakLph: number };
}

export const SPEED_VALUES = [1, 60, 360] as const;

const ActuatorBitKey = z.enum(['fan', 'humidifier', 'refillPump', 'nutrientA', 'nutrientB', 'airPump']);

/** คำสั่งที่ Client ส่งมาที่ POST /api/labs/:labId/commands */
export const LabCommand = z.discriminatedUnion('type', [
  z.object({ type: z.literal('setSpeed'), speed: z.union([z.literal(1), z.literal(60), z.literal(360)]) }),
  z.object({ type: z.literal('pause') }),
  z.object({ type: z.literal('resume') }),
  z.object({ type: z.literal('reset') }),
  z.object({ type: z.literal('setPlcMode'), mode: z.enum(['manual', 'auto', 'offline']) }),
  z.object({ type: z.literal('setManualBit'), key: ActuatorBitKey, value: z.boolean() }),
  z.object({ type: z.literal('setManualLed'), value: z.number().int().min(0).max(100) }),
  z.object({ type: z.literal('applyScenario'), scenarioId: z.string().min(1).max(64) }),
  z.object({ type: z.literal('clearScenario') }),
]);
export type LabCommand = z.infer<typeof LabCommand>;
