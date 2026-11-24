import { z } from 'zod';

/** ระบบบัญชีผู้เล่น (W2 / SPEC § 4.39) — รูปแบบที่ Server และ Web ใช้ร่วมกัน */

export const USERNAME_PATTERN = /^[a-z0-9_]{4,20}$/;
export const PASSWORD_MIN = 8;
/** scrypt รับยาวกว่านี้ได้ แต่จำกัดไว้กันส่งข้อความยาวมากมาเปลือง CPU */
export const PASSWORD_MAX = 72;

/** ID: ตัดช่องว่าง + ตัวพิมพ์เล็ก */
export const normalizeUsername = (raw: string): string => raw.trim().toLowerCase();
/** รหัสเชิญ: ตัดช่องว่าง + ตัวพิมพ์ใหญ่ */
export const normalizeInviteCode = (raw: string): string => raw.trim().toUpperCase();

const Username = z
  .string()
  .transform(normalizeUsername)
  .pipe(z.string().regex(USERNAME_PATTERN, 'ID ใช้ a–z, 0–9 หรือ _ ยาว 4–20 ตัว'));
const Password = z
  .string()
  .min(PASSWORD_MIN, `Password อย่างน้อย ${PASSWORD_MIN} ตัว`)
  .max(PASSWORD_MAX, `Password ไม่เกิน ${PASSWORD_MAX} ตัว`);

export const RegisterRequest = z.object({
  username: Username,
  password: Password,
  inviteCode: z.string().transform(normalizeInviteCode).pipe(z.string().min(1, 'กรอกรหัสเชิญ').max(64)),
});
export type RegisterRequest = z.input<typeof RegisterRequest>;

export const LoginRequest = z.object({
  username: z.string().max(64).transform(normalizeUsername),
  password: z.string().max(PASSWORD_MAX),
});
export type LoginRequest = z.input<typeof LoginRequest>;

export interface AuthPlayer {
  id: number;
  username: string;
  inviteCode: string;
}

export interface AuthResponse {
  token: string;
  /** เวลาหมดอายุ (ms since epoch) */
  expiresAt: number;
  player: AuthPlayer;
}

export interface AuthConfig {
  enabled: boolean;
}

/** รูปแบบ Error ของ API บัญชี */
export interface AuthError {
  error: string;
  code?: string;
  retryAfterS?: number;
}
