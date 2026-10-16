export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/**
 * First-order response แบบ Exact: x เข้าหา target ด้วย time constant tau
 * เสถียรทุกค่า dt (ไม่ overshoot แม้ dt > tau)
 */
export const approach = (x: number, target: number, dtS: number, tauS: number): number =>
  target + (x - target) * Math.exp(-dtS / tauS);

/** Saturation vapour pressure (kPa) — Tetens */
export const svpKPa = (tempC: number): number => 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));

/** Vapour Pressure Deficit จากอากาศ (kPa) — ค่าประมาณเพราะไม่มี Leaf Temperature */
export const vpdKPa = (tempC: number, rhPct: number): number => svpKPa(tempC) * (1 - clamp(rhPct, 0, 100) / 100);
