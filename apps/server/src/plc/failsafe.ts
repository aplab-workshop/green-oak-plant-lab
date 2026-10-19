import type { ActuatorCommands } from '@gol/shared';

/**
 * Fail-safe state (DEVICE-MAP.md § 5) — ใช้เมื่อ Command หมดอายุหรือ PLC Offline
 * ทุกอย่าง OFF ยกเว้น Air Pump เพื่อให้รากยังได้ออกซิเจน
 */
export const FAILSAFE_COMMANDS: Readonly<ActuatorCommands> = Object.freeze({
  fan: false,
  humidifier: false,
  ledPct: 0,
  refillPump: false,
  nutrientA: false,
  nutrientB: false,
  airPump: true,
  phDown: false,
});
