import type { ActuatorCommands } from '@gol/shared';
import {
  initialEnvironment,
  makeConfig,
  simTimeFrom,
  stepEnvironment,
  type EnvironmentState,
  type SimConfig,
} from '../src';

export const OFF: ActuatorCommands = {
  fan: false,
  humidifier: false,
  ledPct: 0,
  refillPump: false,
  nutrientA: false,
  nutrientB: false,
  airPump: true,
};

/** Config ที่อุณหภูมิห้องคงที่ 26 °C เพื่อให้คาดค่าได้ง่าย */
export const flatRoomConfig = (): SimConfig => makeConfig({ room: { tempMeanC: 26, tempAmplitudeC: 0 } });

export interface RunOptions {
  cfg: SimConfig;
  cmd: Partial<ActuatorCommands>;
  hours: number;
  /** ความต้องการน้ำของพืชรวม (L/day) */
  uptakeLPerDay?: number;
  startS?: number;
  env?: EnvironmentState;
}

/** เดิน Environment ตรง ๆ ทีละ dt (ไม่ผ่าน Clock) */
export function runEnv(o: RunOptions): { env: EnvironmentState; simTimeS: number; history: EnvironmentState[] } {
  const dt = o.cfg.time.dtS;
  let t = o.startS ?? simTimeFrom(14, 6);
  let env = o.env ?? initialEnvironment(o.cfg, t);
  const cmd = { ...OFF, ...o.cmd };
  const steps = Math.round((o.hours * 3600) / dt);
  const demandPerStep = ((o.uptakeLPerDay ?? 0) * dt) / 86_400;
  const history: EnvironmentState[] = [];
  for (let i = 0; i < steps; i++) {
    env = stepEnvironment(env, { cmd, simTimeS: t, plantUptakeDemandL: demandPerStep }, dt, o.cfg).state;
    t += dt;
    history.push(env);
  }
  return { env, simTimeS: t, history };
}
