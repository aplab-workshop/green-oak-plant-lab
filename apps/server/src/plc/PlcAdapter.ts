import {
  HEARTBEAT_REGISTER,
  SENSOR_REGISTERS,
  SIM_INFO_REGISTERS,
  WRITABLE_D_ADDRESSES,
  deviceName,
  toRaw,
  type ActuatorCommands,
  type PlcStatus,
  type SensorReadings,
  type SimInfo,
} from '@gol/shared';

/** ข้อมูลที่ Gateway ส่งให้ PLC ในแต่ละรอบ */
export interface SensorWrite {
  sensors: SensorReadings;
  sim: SimInfo;
  /** D120 heartbeat 0…32767 */
  heartbeat: number;
}

export interface CommandRead {
  commands: ActuatorCommands;
  /** เวลาจริงที่อ่านสำเร็จ (ms epoch) */
  at: number;
  /** ค่าที่อ่านได้แต่อยู่นอกช่วงและถูก Clamp */
  outOfRange: string[];
}

/**
 * PLC Adapter (FR-30) — Mock และ SLMP (M3) ใช้ Interface เดียวกัน
 * API มีเฉพาะการเขียน Sensor และอ่าน Command เท่านั้น ไม่มีการเขียน Address อิสระ (FR-31)
 */
export interface PlcAdapter {
  readonly kind: PlcStatus['kind'];
  connect(): Promise<void>;
  close(): Promise<void>;
  /** เขียน D100–D112, D120 — คืนรายชื่อค่าที่ถูก Clamp */
  writeSensors(data: SensorWrite): Promise<{ clamped: string[] }>;
  /** อ่าน M101–M106, D200–D201 (P48: พัดลม D201 แทน M100) */
  readCommands(): Promise<CommandRead>;
  status(): PlcStatus;
}

export class PlcCommError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlcCommError';
  }
}

/** Runtime guard (FR-31): อนุญาตเขียนเฉพาะ D ใน Allowlist */
export function assertWritable(kind: 'D' | 'M', address: number): void {
  if (kind !== 'D' || !WRITABLE_D_ADDRESSES.has(address)) {
    throw new Error(`Write to ${deviceName(kind, address)} is not allowed (gateway may write D100–D112, D120 only)`);
  }
}

export interface EncodedWord {
  address: number;
  raw: number;
}

/** แปลงข้อมูลเป็นรายการ D-register ที่จะเขียน (เรียงตาม Address) */
export function encodeSensorWrite(data: SensorWrite): { words: EncodedWord[]; clamped: string[] } {
  const words: EncodedWord[] = [];
  const clamped: string[] = [];
  for (const reg of SENSOR_REGISTERS) {
    const v = toRaw(reg, data.sensors[reg.key]);
    if (v.clamped) clamped.push(`${deviceName('D', reg.address)} ${reg.label}`);
    words.push({ address: reg.address, raw: v.raw });
  }
  for (const reg of SIM_INFO_REGISTERS) {
    words.push({ address: reg.address, raw: toRaw(reg, data.sim[reg.key]).raw });
  }
  words.push({ address: HEARTBEAT_REGISTER.address, raw: toRaw({ scale: 1, ...HEARTBEAT_REGISTER }, data.heartbeat).raw });
  for (const w of words) assertWritable('D', w.address);
  return { words, clamped };
}

/** Heartbeat ถัดไป วน 0…32767 */
export const nextHeartbeat = (n: number): number => (n >= HEARTBEAT_REGISTER.max ? 0 : n + 1);
