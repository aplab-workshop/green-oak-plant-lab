import type { ActuatorCommands, PlayerDevice, SensorReadings } from '@gol/shared';

/**
 * ผู้ช่วยฟาร์ม (SPEC § 4.6) — คุมเฉพาะอุปกรณ์ที่ด่านยังไม่ปลดล็อก ด้วยเกณฑ์เดียวกับ Ladder ตัวอย่าง
 * (mockPrograms.ts) แบบ Hysteresis จากสถานะเดิม; LED ผู้เล่นคุมทุกด่านจึงไม่อยู่ที่นี่
 * ยกเว้น Nutrient / pH Down ซึ่ง LabSession สั่งครั้งละ 1 โดส (SPEC § 4.7)
 */
export function applyFarmHelper(
  cmd: ActuatorCommands,
  prev: ActuatorCommands,
  s: SensorReadings,
  playerDevices: readonly PlayerDevice[],
  lockedMode: 'off' | 'helper' = 'helper',
): ActuatorCommands {
  const out = { ...cmd };
  const locked = (d: PlayerDevice) => !playerDevices.includes(d);
  if (lockedMode === 'off') {
    // P37 (ด่าน 1): อุปกรณ์ที่ล็อกปิดสนิท ยกเว้นปั๊มลมที่รากต้องการตลอด
    if (locked('refillPump')) out.refillPump = false;
    if (locked('fan')) out.fanPct = 0;
    if (locked('humidifier')) out.humidifier = false;
    if (locked('nutrient')) out.nutrientA = out.nutrientB = false;
    if (locked('airPump')) out.airPump = true;
    if (locked('phDown')) out.phDown = false;
    return out;
  }
  const hyst = (was: boolean, on: boolean, off: boolean) => (on ? true : off ? false : was);
  if (locked('refillPump')) out.refillPump = hyst(prev.refillPump, s.waterLevelPct < 70, s.waterLevelPct >= 90);
  if (locked('fan')) out.fanPct = hyst(prev.fanPct > 0, s.airTempC > 25.5, s.airTempC < 24.5) ? 100 : 0;
  if (locked('humidifier')) out.humidifier = hyst(prev.humidifier, s.rhPct < 55, s.rhPct > 70);
  // Nutrient และ pH Down ที่ล็อก: ผู้ช่วยสั่งเป็นโดสใน LabSession (นับเวลาจำลอง) — ถ้าเปิดค้างตามรอบ Poll
  // ที่ 3600x ปั๊มจะเปิด 30 นาทีจำลองต่อรอบ ทำให้ EC พุ่งเกินจริง (พบใน P22)
  if (locked('nutrient')) out.nutrientA = out.nutrientB = false;
  if (locked('airPump')) out.airPump = true;
  if (locked('phDown')) out.phDown = false;
  return out;
}
