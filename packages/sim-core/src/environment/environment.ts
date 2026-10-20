import type { ActuatorCommands } from '@gol/shared';
import type { SimConfig } from '../config/defaultConfig';
import { SECONDS_PER_DAY } from '../clock';
import { clamp, vpdKPa } from '../math';
import { stepAir, stepWaterTemp, roomTempC } from './air';
import { dliIncrement, ppfdAt, sunFraction, sunPpfd } from './light';
import { ecFrom, stepPh, stepSalt } from './nutrient';
import { powerW } from './power';
import { evaporationL, levelPct, stepTank } from './tank';
import { stepOxygen } from './oxygen';

/** State ของสภาพแวดล้อมในถังและห้องปลูก (ค่าจริงของ Model ไม่มี Noise) */
export interface EnvironmentState {
  waterVolumeL: number;
  /** มวลเกลือรวม (mS/cm·L) → EC = saltMass / volume */
  saltMass: number;
  ph: number;
  airTempC: number;
  rhPct: number;
  waterTempC: number;
  /** Estimated Oxygen Status [0,1] ไร้หน่วย ไม่ใช่ Sensor DO */
  estimatedOxygen: number;
  /** LED ที่ใช้จริงใน step ล่าสุด (%) */
  ledPct: number;
  /** PPFD ที่ตำแหน่ง Sensor (กลางถัง) */
  ppfd: number;
  /** PPFD จากแดดในส่วนนี้ (P36) */
  sunPpfd: number;
  /** DLI สะสมตั้งแต่ 00:00 เวลาจำลอง ที่ตำแหน่ง Sensor */
  dliToday: number;
  dliYesterday: number;
  /** อัตราไหล Refill ล่าสุด (L/min) */
  refillFlowLpm: number;
  /** น้ำที่เกินความจุใน step ล่าสุด (L/min) */
  overflowFlowLpm: number;
  powerW: number;
  /** สะสมเพื่อสถิติ (L) */
  totalRefillL: number;
  totalUptakeL: number;
  totalOverflowL: number;
  totalLeakL: number;
}

export interface EnvironmentInput {
  cmd: ActuatorCommands;
  /** เวลาจำลองตอนเริ่ม step (s) */
  simTimeS: number;
  /** น้ำที่พืชทั้งหมดต้องการใน step นี้ (L) — มาจาก Plant model (P3) */
  plantUptakeDemandL: number;
  /** น้ำรั่ว (L/h) — Scenario disturbance, ค่าเริ่มต้น 0 */
  leakLph?: number;
  /** ผลของเหตุการณ์ (SPEC § 4.8) */
  roomTempDeltaC?: number;
  roomRhDeltaPct?: number;
  tapPh?: number;
}

export interface EnvironmentStepResult {
  state: EnvironmentState;
  /** น้ำที่พืชได้จริง (L) — อาจน้อยกว่าที่ขอถ้าน้ำในถังไม่พอ */
  uptakeL: number;
}

export function initialEnvironment(cfg: SimConfig, simTimeS: number): EnvironmentState {
  const volume = (cfg.tank.initialLevelPct / 100) * cfg.tank.capacityL;
  const tRoom = roomTempC(simTimeS, cfg);
  return {
    waterVolumeL: volume,
    saltMass: cfg.nutrient.initialEc * volume,
    ph: cfg.nutrient.initialPh,
    airTempC: tRoom,
    rhPct: cfg.room.rhPct,
    waterTempC: tRoom - 2,
    estimatedOxygen: volume > 0 ? cfg.root.initialOxygen : 0,
    ledPct: 0,
    ppfd: 0,
    sunPpfd: 0,
    dliToday: 0,
    dliYesterday: 0,
    refillFlowLpm: 0,
    overflowFlowLpm: 0,
    powerW: 0,
    totalRefillL: 0,
    totalUptakeL: 0,
    totalOverflowL: 0,
    totalLeakL: 0,
  };
}

/** เดิน Environment 1 step (Pure function) */
export function stepEnvironment(
  s: EnvironmentState,
  u: EnvironmentInput,
  dtS: number,
  cfg: SimConfig,
): EnvironmentStepResult {
  const { cmd } = u;
  const dtMin = dtS / 60;
  const ledPct = clamp(Number.isFinite(cmd.ledPct) ? cmd.ledPct : 0, 0, 100);

  // --- Air ---
  const air = stepAir(
    s,
    { simTimeS: u.simTimeS, ledPct, fan: cmd.fan, humidifier: cmd.humidifier, roomTempDeltaC: u.roomTempDeltaC, roomRhDeltaPct: u.roomRhDeltaPct,
      sunFrac: sunFraction(u.simTimeS, cfg) },
    dtS,
    cfg,
  );
  const vpd = vpdKPa(air.airTempC, air.rhPct);

  // --- Water balance ---
  const refillInL = cmd.refillPump ? cfg.tank.refillFlowLpm * dtMin : 0;
  const doseAL = cmd.nutrientA ? cfg.nutrient.doseFlowLpm * dtMin : 0;
  const doseBL = cmd.nutrientB ? cfg.nutrient.doseFlowLpm * dtMin : 0;
  const tank = stepTank(
    s.waterVolumeL,
    {
      refillInL,
      doseInL: doseAL + doseBL,
      uptakeDemandL: Math.max(0, u.plantUptakeDemandL),
      evapL: evaporationL(vpd, dtS, cfg),
      leakL: ((u.leakLph ?? 0) * dtS) / 3600,
    },
    cfg,
  );

  // --- Nutrient ---
  const saltMass = stepSalt(
    s.saltMass,
    { volumeBeforeL: s.waterVolumeL, refillInL, doseAL, doseBL, uptakeL: tank.uptakeL, drainL: tank.overflowL + tank.leakL },
    cfg,
  );
  const doseMinutes = ((cmd.nutrientA ? 1 : 0) + (cmd.nutrientB ? 1 : 0)) * dtMin;
  const ph = stepPh(s.ph, { volumeBeforeL: s.waterVolumeL, refillInL, doseMinutes, phDownMinutes: cmd.phDown ? dtMin : 0, tapPh: u.tapPh }, dtS, cfg);

  // --- Water temperature ---
  const waterTempC = stepWaterTemp(s.waterTempC, air.airTempC, s.waterVolumeL, refillInL, dtS, cfg);
  const estimatedOxygen = stepOxygen(s.estimatedOxygen, cmd.airPump, waterTempC, levelPct(tank.volumeL, cfg), dtS, cfg);

  // --- Light & DLI (reset ตอนข้ามเที่ยงคืนเวลาจำลอง) ---
  // P36: PAR Sensor (กลางถัง) วัดแดด + LED
  const sun = sunPpfd(u.simTimeS, cfg);
  const ppfd = ppfdAt(ledPct, 1, cfg) + sun;
  let dliToday = s.dliToday;
  let dliYesterday = s.dliYesterday;
  const crossesMidnight =
    Math.floor((u.simTimeS + dtS) / SECONDS_PER_DAY) !== Math.floor(u.simTimeS / SECONDS_PER_DAY);
  if (crossesMidnight) {
    dliYesterday = dliToday + dliIncrement(ppfd, dtS);
    dliToday = 0;
  } else {
    dliToday += dliIncrement(ppfd, dtS);
  }

  return {
    uptakeL: tank.uptakeL,
    state: {
      waterVolumeL: tank.volumeL,
      saltMass,
      ph,
      airTempC: air.airTempC,
      rhPct: air.rhPct,
      waterTempC,
      estimatedOxygen,
      ledPct,
      ppfd,
      sunPpfd: sun,
      dliToday,
      dliYesterday,
      refillFlowLpm: cmd.refillPump ? cfg.tank.refillFlowLpm : 0,
      overflowFlowLpm: dtS > 0 ? tank.overflowL * 60 / dtS : 0,
      powerW: powerW({ ...cmd, ledPct }, cfg),
      totalRefillL: s.totalRefillL + refillInL,
      totalUptakeL: s.totalUptakeL + tank.uptakeL,
      totalOverflowL: s.totalOverflowL + tank.overflowL,
      totalLeakL: s.totalLeakL + tank.leakL,
    },
  };
}

/** EC ปัจจุบันของ State */
export const envEc = (s: EnvironmentState): number => ecFrom(s.saltMass, s.waterVolumeL);
