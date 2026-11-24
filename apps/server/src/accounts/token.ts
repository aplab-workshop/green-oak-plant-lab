import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Token ของผู้เล่น (W2 / SPEC § 4.39) — `<payload base64url>.<HMAC-SHA256 base64url>`
 * payload = { p: playerId, v: ลายนิ้วมือ Password ปัจจุบัน, e: หมดอายุ (ms) }
 * เปลี่ยน/รีเซ็ต Password → v ไม่ตรง → Token เดิมใช้ไม่ได้
 */

export const TOKEN_TTL_MS = 7 * 24 * 3600 * 1000;

export interface TokenPayload {
  p: number;
  v: string;
  e: number;
}

/** ลายนิ้วมือสั้น ๆ ของ password hash (ไม่เปิดเผย hash เอง) */
export function passwordVersion(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('base64url').slice(0, 12);
}

const sign = (secret: string, body: string) => createHmac('sha256', secret).update(body).digest('base64url');

export function signToken(secret: string, playerId: number, passwordHash: string, now: number): { token: string; expiresAt: number } {
  const payload: TokenPayload = { p: playerId, v: passwordVersion(passwordHash), e: now + TOKEN_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { token: `${body}.${sign(secret, body)}`, expiresAt: payload.e };
}

/** null = ลายเซ็นผิด / รูปแบบผิด / หมดอายุ (ยังต้องเทียบ v กับฐานข้อมูลเอง) */
export function verifyToken(secret: string, token: string, now: number): TokenPayload | null {
  const [body, mac, extra] = token.split('.');
  if (!body || !mac || extra !== undefined) return null;
  const expected = Buffer.from(sign(secret, body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as Partial<TokenPayload>;
    if (!Number.isInteger(payload.p) || typeof payload.v !== 'string' || typeof payload.e !== 'number') return null;
    return payload.e > now ? (payload as TokenPayload) : null;
  } catch {
    return null;
  }
}
