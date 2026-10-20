import {
  LIGHT_LOAD_STRESS_H,
  LIGHT_LOAD_WARN_H,
  SENSOR_RANGES,
  isDaytime,
  isPlantDead,
  sensorStatus,
  type LabSnapshot,
  type SensorStatus,
} from '@gol/shared';
import { canControl, goalProgress } from './gameModel';

/**
 * "สิ่งที่ต้องดูของด่าน" (SPEC § 4.14) — Pure: เลือกมาตรวัดตามอุปกรณ์ของด่านและแปลงค่าจาก Snapshot
 */

export interface WatchDial {
  key: 'water' | 'ppfd' | 'lightLoad' | 'ec' | 'temp' | 'rh' | 'ph';
  icon: string;
  label: string;
  value: number;
  /** ข้อความกลางหน้าปัด */
  display: string;
  /** ช่วงแนะนำใต้หน้าปัด */
  rangeText: string;
  scale: [number, number];
  ok: [number, number];
  warn: [number, number];
  status: SensorStatus;
}

export interface WatchGoal {
  targetG: number;
  minG: number;
  startG: number;
  ratio: number;
  /** วินาทีจำลองที่เหลือ (null = ไม่จำกัดเวลา) */
  remainingS: number | null;
  limitDays: number | null;
}

const PPFD_OK: [number, number] = [200, 350];
const PPFD_WARN: [number, number] = [100, 500];

const statusIn = (v: number, ok: [number, number], warn: [number, number]): SensorStatus =>
  v >= ok[0] && v <= ok[1] ? 'ok' : v >= warn[0] && v <= warn[1] ? 'warn' : 'alarm';

const fmtRange = (r: [number, number], unit: string, digits = 0) =>
  `${r[0].toFixed(digits)}–${r[1].toFixed(digits)}${unit}`;

function sensorDial(
  key: WatchDial['key'], sensor: 'waterLevelPct' | 'ecMsCm' | 'airTempC' | 'rhPct' | 'ph',
  icon: string, label: string, value: number, unit: string, digits: number, rangeDigits: number, scale: [number, number],
): WatchDial {
  const r = SENSOR_RANGES[sensor]!;
  return { key, icon, label, value, display: `${value.toFixed(digits)}${unit}`, rangeText: fmtRange(r.ok, unit, rangeDigits),
    scale, ok: r.ok, warn: r.warn, status: sensorStatus(sensor, value) };
}

export function watchDials(s: LabSnapshot): WatchDial[] {
  if (!s.level) return [];
  const r = s.sensors;
  const out: WatchDial[] = [sensorDial('water', 'waterLevelPct', '💧', 'ระดับน้ำ', r.waterLevelPct, '%', 0, 0, [0, 100])];

  const dark = s.commands.ledPct <= 0 && !isDaytime(s.sim.minuteOfDay);
  out.push({ key: 'ppfd', icon: '☀️', label: 'แสง (PPFD)', value: r.ppfd, display: dark ? 'มืด' : r.ppfd.toFixed(0),
    rangeText: fmtRange(PPFD_OK, ''), scale: [0, 500], ok: PPFD_OK, warn: PPFD_WARN,
    status: dark ? 'neutral' : statusIn(r.ppfd, PPFD_OK, PPFD_WARN) });

  const alive = s.plants.filter((p) => !isPlantDead(p, s.game.deadPlantIds));
  const load = alive.length ? Math.max(...alive.map((p) => p.lightLoadH)) : 0;
  const loadOk: [number, number] = [0, LIGHT_LOAD_WARN_H];
  const loadWarn: [number, number] = [0, LIGHT_LOAD_STRESS_H];
  out.push({ key: 'lightLoad', icon: '🌙', label: 'แสงสะสม', value: load, display: `${load.toFixed(0)} ชม.`,
    rangeText: `< ${LIGHT_LOAD_WARN_H} ชม.`, scale: [0, 24], ok: loadOk, warn: loadWarn, status: statusIn(load, loadOk, loadWarn) });

  if (canControl(s, 'nutrient')) out.push(sensorDial('ec', 'ecMsCm', '🧪', 'EC (ปุ๋ย)', r.ecMsCm, '', 2, 1, [0, 2.5]));
  if (canControl(s, 'fan')) out.push(sensorDial('temp', 'airTempC', '🌡️', 'อุณหภูมิ', r.airTempC, '°C', 1, 0, [10, 35]));
  if (canControl(s, 'humidifier')) out.push(sensorDial('rh', 'rhPct', '💨', 'ความชื้น', r.rhPct, '%', 0, 0, [30, 100]));
  if (canControl(s, 'phDown')) out.push(sensorDial('ph', 'ph', '⚗️', 'pH', r.ph, '', 2, 1, [4, 8]));
  return out;
}

export function watchGoal(s: LabSnapshot): WatchGoal | null {
  if (!s.level) return null;
  const goal = goalProgress(s);
  const limit = s.game.timeLimitS;
  return {
    targetG: goal.targetG,
    minG: goal.minG,
    startG: s.level.startBiomassG,
    ratio: goal.ratio,
    remainingS: limit === null ? null : Math.max(0, limit - s.game.elapsedS),
    limitDays: limit === null ? null : limit / 86_400,
  };
}

/** "x วัน y ชม." */
export function formatRemaining(seconds: number): string {
  const totalH = Math.floor(seconds / 3600);
  const d = Math.floor(totalH / 24);
  const h = totalH % 24;
  return d > 0 ? `${d} วัน ${h} ชม.` : `${h} ชม.`;
}
