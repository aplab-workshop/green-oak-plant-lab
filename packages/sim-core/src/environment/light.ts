import type { SimConfig } from '../config/defaultConfig';
import { clamp } from '../math';
import { hourOfDay } from '../clock';

/** PPFD (µmol/m²/s) ที่ตำแหน่งที่มี position factor ที่กำหนด (FR-05) */
export const ppfdAt = (ledPct: number, positionFactor: number, cfg: SimConfig): number =>
  cfg.light.ppfdMax * (clamp(ledPct, 0, 100) / 100) * positionFactor;

/** DLI ที่เพิ่มขึ้นใน dt (mol/m²) = PPFD·dt / 10⁶ */
export const dliIncrement = (ppfd: number, dtS: number): number => (ppfd * dtS) / 1e6;

/** Position factor ของต้นที่ index (ถ้าไม่ได้กำหนดใช้ 1) */
export const positionFactor = (index: number, cfg: SimConfig): number => cfg.light.positionFactors[index] ?? 1;

/**
 * PPFD จากแดด (P36) — ครึ่งคลื่น sine ขึ้นจาก riseHour ถึงสูงสุดที่ peakHour แล้วลงถึง setHour
 * เท่ากันทุกตำแหน่ง (ผ่านหลังคา) ไม่ขึ้นกับ positionFactor ของ LED
 */
export function sunPpfd(simTimeS: number, cfg: SimConfig): number {
  const { peakPpfd, riseHour, peakHour, setHour } = cfg.sun;
  if (peakPpfd <= 0) return 0;
  const h = hourOfDay(simTimeS);
  if (h <= riseHour || h >= setHour) return 0;
  const phase = h < peakHour ? (h - riseHour) / (peakHour - riseHour) : (setHour - h) / (setHour - peakHour);
  return peakPpfd * Math.sin((Math.PI / 2) * clamp(phase, 0, 1));
}

/** สัดส่วนแดดเทียบสูงสุด 0–1 (ใช้คำนวณความร้อนจากแดด) */
export const sunFraction = (simTimeS: number, cfg: SimConfig): number =>
  cfg.sun.peakPpfd > 0 ? sunPpfd(simTimeS, cfg) / cfg.sun.peakPpfd : 0;

