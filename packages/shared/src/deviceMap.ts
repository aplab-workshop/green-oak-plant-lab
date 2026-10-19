import type { ActuatorKey, SensorReadings, SimInfo } from './types';

/**
 * PLC Device Mapping — Single Source of Truth
 * ต้องตรงกับ docs/DEVICE-MAP.md เสมอ
 */

export const INT16_MIN = -32768;
export const INT16_MAX = 32767;

export interface WordRegister<K extends string> {
  key: K;
  /** D-register number เช่น 100 = D100 */
  address: number;
  label: string;
  unit: string;
  /** raw = round(value × scale) */
  scale: number;
  /** ช่วง raw ที่อนุญาต (หลัง Scaling) */
  min: number;
  max: number;
}

export type SensorKey = keyof SensorReadings;
export type SimInfoKey = keyof SimInfo;

export const SENSOR_REGISTERS: readonly WordRegister<SensorKey>[] = [
  { key: 'airTempC', address: 100, label: 'Air Temperature', unit: '°C', scale: 10, min: -100, max: 600 },
  { key: 'rhPct', address: 101, label: 'Relative Humidity', unit: '%RH', scale: 10, min: 0, max: 1000 },
  { key: 'ppfd', address: 102, label: 'PPFD', unit: 'µmol/m²/s', scale: 1, min: 0, max: 2500 },
  { key: 'waterTempC', address: 103, label: 'Water Temperature', unit: '°C', scale: 10, min: -100, max: 600 },
  { key: 'ph', address: 104, label: 'pH', unit: 'pH', scale: 100, min: 0, max: 1400 },
  { key: 'ecMsCm', address: 105, label: 'EC', unit: 'mS/cm', scale: 100, min: 0, max: 1000 },
  { key: 'waterLevelPct', address: 106, label: 'Water Level', unit: '%', scale: 1, min: 0, max: 100 },
  { key: 'flowLpm', address: 107, label: 'Refill Water Flow', unit: 'L/min', scale: 100, min: 0, max: 1000 },
  { key: 'powerW', address: 108, label: 'Power Consumption', unit: 'W', scale: 1, min: 0, max: 5000 },
  { key: 'vpdKPa', address: 109, label: 'VPD (Estimated)', unit: 'kPa', scale: 100, min: 0, max: 1000 },
  { key: 'dli', address: 110, label: 'DLI (today)', unit: 'mol/m²/day', scale: 100, min: 0, max: 10000 },
];

export const SIM_INFO_REGISTERS: readonly WordRegister<SimInfoKey>[] = [
  { key: 'minuteOfDay', address: 111, label: 'Sim Time of Day', unit: 'min', scale: 1, min: 0, max: 1439 },
  { key: 'day', address: 112, label: 'Sim Day', unit: 'day', scale: 1, min: 0, max: INT16_MAX },
];

/** D120: Gateway heartbeat นับ 0…32767 วนซ้ำ */
export const HEARTBEAT_REGISTER = { address: 120, label: 'Gateway Heartbeat', min: 0, max: INT16_MAX } as const;

export interface BitCommand {
  key: Exclude<ActuatorKey, 'ledPct'>;
  /** M-device number เช่น 100 = M100 */
  address: number;
  label: string;
}

export const COMMAND_BITS: readonly BitCommand[] = [
  { key: 'fan', address: 100, label: 'Ventilation Fan' },
  { key: 'humidifier', address: 101, label: 'Humidifier' },
  { key: 'refillPump', address: 102, label: 'Water Refill Pump' },
  { key: 'nutrientA', address: 103, label: 'Nutrient Pump A' },
  { key: 'nutrientB', address: 104, label: 'Nutrient Pump B' },
  { key: 'airPump', address: 105, label: 'Air Pump' },
  { key: 'phDown', address: 106, label: 'pH Down Pump' },
];

export const LED_COMMAND_REGISTER = {
  key: 'ledPct',
  address: 200,
  label: 'Grow Light Brightness',
  unit: '%',
  min: 0,
  max: 100,
} as const;

/** D-registers ที่ Gateway อนุญาตให้เขียน (FR-31) */
export const WRITABLE_D_ADDRESSES: ReadonlySet<number> = new Set([
  ...SENSOR_REGISTERS.map((r) => r.address),
  ...SIM_INFO_REGISTERS.map((r) => r.address),
  HEARTBEAT_REGISTER.address,
]);

export interface ScaledValue {
  raw: number;
  /** true ถ้าค่าเกินช่วงและถูก Clamp */
  clamped: boolean;
}

/** แปลงค่าทางวิศวกรรมเป็น INT16 ตาม Scaling ของ Register */
export function toRaw(reg: Pick<WordRegister<string>, 'scale' | 'min' | 'max'>, value: number): ScaledValue {
  if (!Number.isFinite(value)) return { raw: reg.min, clamped: true };
  const scaled = Math.round(value * reg.scale);
  const raw = Math.min(reg.max, Math.max(reg.min, scaled));
  return { raw, clamped: raw !== scaled };
}

/** แปลง INT16 กลับเป็นค่าทางวิศวกรรม */
export function fromRaw(reg: Pick<WordRegister<string>, 'scale'>, raw: number): number {
  return raw / reg.scale;
}

/** ชื่อ Device แบบ GX Works3 เช่น "D100", "M102" */
export const deviceName = (kind: 'D' | 'M', address: number): string => `${kind}${address}`;
