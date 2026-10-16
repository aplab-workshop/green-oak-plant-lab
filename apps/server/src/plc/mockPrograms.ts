import { COMMAND_BITS, LED_COMMAND_REGISTER } from '@gol/shared';
import type { DeviceMemory } from './DeviceMemory';

/**
 * Logic ตัวอย่างที่จำลอง "Ladder ใน PLC" (ARCHITECTURE.md § 8)
 * อ่าน D-register ที่ Scaled แล้ว และเขียน M/D ภายใน PLC — เหมือนโปรแกรมที่นักเรียนเขียน
 *
 *   Refill  : SET M102 ถ้า D106 < 70   | RST ถ้า D106 ≥ 90
 *   Fan     : SET M100 ถ้า D100 > 255  | RST ถ้า D100 < 245
 *   Humid.  : SET M101 ถ้า D101 < 550  | RST ถ้า D101 > 700
 *   LED     : D200 = 80 เมื่อ D111 อยู่ระหว่าง 06:00–22:00 (360–1319) มิฉะนั้น 0
 *   Nutrient: SET M103,M104 ถ้า D105 < 100 | RST ถ้า D105 ≥ 120
 *   Air pump: M105 ON ตลอด (SM400)
 */
export function autoProgramScan(mem: DeviceMemory): void {
  const d = (a: number) => mem.getD(a);
  const setReset = (m: number, set: boolean, reset: boolean) => {
    if (set) mem.setM(m, true);
    else if (reset) mem.setM(m, false);
  };

  setReset(102, d(106) < 70, d(106) >= 90);
  setReset(100, d(100) > 255, d(100) < 245);
  setReset(101, d(101) < 550, d(101) > 700);
  const minute = d(111);
  mem.setD(LED_COMMAND_REGISTER.address, minute >= 360 && minute < 1320 ? 80 : 0);
  const ecLow = d(105) < 100;
  const ecOk = d(105) >= 120;
  setReset(103, ecLow, ecOk);
  setReset(104, ecLow, ecOk);
  mem.setM(105, true);
}

/** ล้างคำสั่งทั้งหมดใน PLC (เช่นตอนเปลี่ยนโหมด) แต่คง Air pump ไว้ */
export function clearCommands(mem: DeviceMemory): void {
  for (const b of COMMAND_BITS) mem.setM(b.address, b.key === 'airPump');
  mem.setD(LED_COMMAND_REGISTER.address, 0);
}
