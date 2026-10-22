import type { ActuatorCommands } from '@gol/shared';
import type { SimConfig } from '../config/defaultConfig';
import { clamp } from '../math';

/** กำลังไฟรวม (W) จาก Actuator ที่ทำงาน (FR-10) */
export function powerW(cmd: ActuatorCommands, cfg: SimConfig): number {
  const p = cfg.power;
  return (
    p.ledW * (clamp(cmd.ledPct, 0, 100) / 100) +
    (p.fanW * Math.min(100, Math.max(0, cmd.fanPct || 0))) / 100 +
    (cmd.humidifier ? p.humidifierW : 0) +
    (cmd.refillPump ? p.refillPumpW : 0) +
    (cmd.nutrientA ? p.nutrientPumpW : 0) +
    (cmd.nutrientB ? p.nutrientPumpW : 0) +
    (cmd.airPump ? p.airPumpW : 0) +
    (cmd.phDown ? p.phDownPumpW : 0)
  );
}
