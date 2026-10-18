import type { ActuatorCommands, PlayerDevice, SensorReadings } from '@gol/shared';

/**
 * ผู้ช่วยฟาร์ม (SPEC § 4.6) — คุมเฉพาะอุปกรณ์ที่ด่านยังไม่ปลดล็อก ด้วยเกณฑ์เดียวกับ Ladder ตัวอย่าง
 * (mockPrograms.ts) แบบ Hysteresis จากสถานะเดิม; LED ผู้เล่นคุมทุกด่านจึงไม่อยู่ที่นี่
 */
export function applyFarmHelper(
  cmd: ActuatorCommands,
  prev: ActuatorCommands,
  s: SensorReadings,
  playerDevices: readonly PlayerDevice[],
): ActuatorCommands {
  const out = { ...cmd };
  const locked = (d: PlayerDevice) => !playerDevices.includes(d);
  const hyst = (was: boolean, on: boolean, off: boolean) => (on ? true : off ? false : was);
  if (locked('refillPump')) out.refillPump = hyst(prev.refillPump, s.waterLevelPct < 70, s.waterLevelPct >= 90);
  if (locked('fan')) out.fan = hyst(prev.fan, s.airTempC > 25.5, s.airTempC < 24.5);
  if (locked('humidifier')) out.humidifier = hyst(prev.humidifier, s.rhPct < 55, s.rhPct > 70);
  if (locked('nutrient')) out.nutrientA = out.nutrientB = hyst(prev.nutrientA, s.ecMsCm < 1.0, s.ecMsCm >= 1.2);
  if (locked('airPump')) out.airPump = true;
  return out;
}
