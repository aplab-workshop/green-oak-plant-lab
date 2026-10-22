import { COMMAND_BITS, FAN_COMMAND_REGISTER, LED_COMMAND_REGISTER } from '@gol/shared';
import type { DeviceMemory } from './DeviceMemory';

/**
 * Logic ตัวอย่างที่จำลอง "Ladder ใน PLC" (ARCHITECTURE.md § 8)
 * อ่าน D-register ที่ Scaled แล้ว และเขียน M/D ภายใน PLC — เหมือนโปรแกรมที่นักเรียนเขียน
 *
 *   Refill  : SET M102 ถ้า D106 < 70   | RST ถ้า D106 ≥ 90
 *   Fan     : D201 = 100 ถ้า D100 > 255 | D201 = 0 ถ้า D100 < 245 (P48: ความเร็ว 0–100 % แทน M100)
 *   Humid.  : SET M101 ถ้า D101 < 550  | RST ถ้า D101 > 700
 *   LED     : 06:00–22:00 (D111 360–1319) เติมแสงให้ PPFD (D102) อยู่ ~270–330:
 *             D102 < 270 → D200 += 5 · D102 > 330 → D200 −= 5 (0–100) · นอกเวลา D200 = 0 (P36: มีแดดร่วม)
 *   Nutrient: SET M103,M104 ถ้า D105 < 100 | RST ถ้า D105 ≥ 120
 *   Air pump: M105 ON ตลอด (SM400)
 *   pH Down : SET M106 ถ้า D104 > 660  | RST ถ้า D104 ≤ 630
 */
export function autoProgramScan(mem: DeviceMemory): void {
  const d = (a: number) => mem.getD(a);
  const setReset = (m: number, set: boolean, reset: boolean) => {
    if (set) mem.setM(m, true);
    else if (reset) mem.setM(m, false);
  };

  setReset(102, d(106) < 70, d(106) >= 90);
  if (d(100) > 255) mem.setD(FAN_COMMAND_REGISTER.address, 100);
  else if (d(100) < 245) mem.setD(FAN_COMMAND_REGISTER.address, 0);
  setReset(101, d(101) < 550, d(101) > 700);
  const minute = d(111);
  // P36: แดดให้แสงด้วย จึงเติม LED เท่าที่ขาด (ปรับทีละ 5 % ต่อ Scan)
  const led = d(LED_COMMAND_REGISTER.address);
  const ppfd = d(102);
  const day = minute >= 360 && minute < 1320;
  mem.setD(LED_COMMAND_REGISTER.address, !day ? 0 : ppfd < 270 ? Math.min(100, led + 5) : ppfd > 330 ? Math.max(0, led - 5) : led);
  const ecLow = d(105) < 100;
  const ecOk = d(105) >= 120;
  setReset(103, ecLow, ecOk);
  setReset(104, ecLow, ecOk);
  mem.setM(105, true);
  // pH Down (P22): SET M106 ถ้า D104 > 660 | RST ถ้า D104 ≤ 630
  setReset(106, d(104) > 660, d(104) <= 630);
}

/** ล้างคำสั่งทั้งหมดใน PLC (เช่นตอนเปลี่ยนโหมด) แต่คง Air pump ไว้ */
export function clearCommands(mem: DeviceMemory): void {
  for (const b of COMMAND_BITS) mem.setM(b.address, b.key === 'airPump');
  mem.setD(LED_COMMAND_REGISTER.address, 0);
  mem.setD(FAN_COMMAND_REGISTER.address, 0);
}
