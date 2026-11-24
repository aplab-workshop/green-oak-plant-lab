import { randomInt } from 'node:crypto';

/** รหัสเชิญ/Password ชั่วคราว (W3 / SPEC § 4.40) — ตัดตัวที่อ่านสับสน (0/O, 1/I/L) */

const UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LOWER = 'abcdefghjkmnpqrstuvwxyz23456789';

const pick = (alphabet: string, n: number) => Array.from({ length: n }, () => alphabet[randomInt(alphabet.length)]).join('');

/** `GO-XXXX-XXXX` — 31^8 ≈ 8.5 × 10^11 แบบ */
export const randomInviteCode = (): string => `GO-${pick(UPPER, 4)}-${pick(UPPER, 4)}`;

/** Password ชั่วคราวสำหรับรีเซ็ต — 10 ตัว พิมพ์ตามได้ง่าย */
export const randomTempPassword = (): string => pick(LOWER, 10);
