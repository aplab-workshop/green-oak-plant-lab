import type { SensorReadings, SimInfo } from '@gol/shared';
import type { SimConfig } from './config/defaultConfig';
import type { EnvironmentState } from './environment/environment';
import { envEc } from './environment/environment';
import { levelPct } from './environment/tank';
import { minuteOfDay, simDay } from './clock';
import { clamp, vpdKPa } from './math';
import type { Rng } from './rng';

/**
 * แปลง State ของ Model เป็นค่า Sensor (FR-11)
 * Noise ใส่ที่ค่าที่อ่านเท่านั้น ไม่เปลี่ยน State — ส่ง rng = undefined เพื่อปิด Noise
 */
export function readSensors(env: EnvironmentState, cfg: SimConfig, rng?: Rng): SensorReadings {
  const n = (sd: number) => (rng && sd > 0 ? rng.gaussian(0, sd) : 0);
  const z = cfg.noise;
  return {
    airTempC: env.airTempC + n(z.airTempC),
    rhPct: clamp(env.rhPct + n(z.rhPct), 0, 100),
    ppfd: Math.max(0, env.ppfd + (env.ppfd > 0 ? n(z.ppfd) : 0)),
    waterTempC: env.waterTempC + n(z.waterTempC),
    ph: env.ph + n(z.ph),
    ecMsCm: Math.max(0, envEc(env) + n(z.ecMsCm)),
    waterLevelPct: clamp(levelPct(env.waterVolumeL, cfg) + n(z.waterLevelPct), 0, 100),
    flowLpm: env.refillFlowLpm,
    powerW: env.powerW,
    // VPD คำนวณจากค่าจริงของอากาศ (ค่าประมาณ ไม่มี Leaf Temperature)
    vpdKPa: vpdKPa(env.airTempC, env.rhPct),
    dli: env.dliToday,
  };
}

/** ข้อมูลเวลาจำลองสำหรับ D111/D112 */
export const readSimInfo = (simTimeS: number): SimInfo => ({
  minuteOfDay: minuteOfDay(simTimeS),
  day: simDay(simTimeS),
});
