/**
 * ขนาดและตำแหน่งในฉาก 3D (หน่วยเมตร) — ตรงกับ Config ของ Simulation
 * ถังภายใน 50 × 40 × 20 cm, ก้น Net Pot สูง 15 cm จากพื้นถัง
 */
export const TANK = {
  width: 0.5,
  depth: 0.4,
  height: 0.2,
  wall: 0.008,
} as const;

export const LID = { thickness: 0.012, overhang: 0.012 } as const;

export const POT = {
  topRadius: 0.03,
  bottomRadius: 0.022,
  /** ขอบบน Net Pot = ผิวบนของฝา */
  topY: TANK.height + LID.thickness,
  /** ก้น Net Pot (15 cm) */
  bottomY: 0.15,
  holeRadius: 0.028,
} as const;

/** ระยะห่าง Net Pot ตามแกน x (คอลัมน์) และ z (แถว) */
const POT_SPACING_X = 0.15;
const POT_SPACING_Z = 0.2;

/**
 * ตำแหน่ง Net Pot ตาม index (row-major, 3 คอลัมน์)
 * index 1 และ 4 อยู่คอลัมน์กลาง ตรงกับ positionFactor = 1.0 ใน Simulation
 */
export function potPosition(index: number, count: number): [number, number] {
  const cols = count <= 6 ? 3 : 4;
  const rows = Math.ceil(count / cols);
  const col = index % cols;
  const row = Math.floor(index / cols);
  const spacingX = cols === 3 ? POT_SPACING_X : 0.12;
  const spacingZ = rows > 1 ? Math.min(POT_SPACING_Z, 0.3 / (rows - 1)) : 0;
  return [(col - (cols - 1) / 2) * spacingX, (row - (rows - 1) / 2) * spacingZ];
}

/** cm → m */
export const cm = (v: number): number => v / 100;

export const LED_Y = 0.58;
