import type { SimConfig } from '../config/defaultConfig';
import { clamp } from '../math';

/** PPFD (µmol/m²/s) ที่ตำแหน่งที่มี position factor ที่กำหนด (FR-05) */
export const ppfdAt = (ledPct: number, positionFactor: number, cfg: SimConfig): number =>
  cfg.light.ppfdMax * (clamp(ledPct, 0, 100) / 100) * positionFactor;

/** DLI ที่เพิ่มขึ้นใน dt (mol/m²) = PPFD·dt / 10⁶ */
export const dliIncrement = (ppfd: number, dtS: number): number => (ppfd * dtS) / 1e6;

/** Position factor ของต้นที่ index (ถ้าไม่ได้กำหนดใช้ 1) */
export const positionFactor = (index: number, cfg: SimConfig): number => cfg.light.positionFactors[index] ?? 1;
