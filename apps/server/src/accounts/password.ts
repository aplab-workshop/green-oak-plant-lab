import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/** Password hash (W2 / SPEC § 4.39) — scrypt + salt สุ่ม เก็บเป็น `scrypt$N$r$p$salt$hash` (base64url) */

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

function derive(password: string, salt: Buffer, opts: ScryptOptions, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFC'), salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { N, r: R, p: P }, KEYLEN);
  return ['scrypt', N, R, P, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [n, r, p] = parts.slice(1, 4).map(Number) as [number, number, number];
  const salt = Buffer.from(parts[4]!, 'base64url');
  const expected = Buffer.from(parts[5]!, 'base64url');
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p) || expected.length === 0) return false;
  const key = await derive(password, salt, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, expected.length);
  return timingSafeEqual(key, expected);
}

/** Hash หลอกสำหรับ ID ที่ไม่มีอยู่ — ใช้เวลาตรวจเท่ากัน ไม่ให้เดาได้ว่า ID มีหรือไม่ */
let dummy: Promise<string> | null = null;
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(randomBytes(12).toString('hex'));
  return dummy;
}
