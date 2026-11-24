import { create } from 'zustand';
import type { AuthConfig, AuthError, AuthPlayer, AuthResponse, LoginRequest, RegisterRequest } from '@gol/shared';
import { DEMO } from '../demo/mode';

/**
 * บัญชีผู้เล่นฝั่ง Web (W2 / SPEC § 4.39)
 * - โหมดปกติ: ถาม Server เดิม (`/api/auth/config`) — ไม่ได้ตั้ง DATABASE_URL = ปิด เล่นได้เลย
 * - Demo (Pages): เปิดเมื่อ build ด้วย VITE_ACCOUNTS_API (URL ของ Server บน Cloud)
 * ไม่ผ่าน apiFetch ของ Demo เพราะบัญชีต้องอยู่บน Server จริงเสมอ
 */

const DEMO_API = (import.meta.env.VITE_ACCOUNTS_API as string | undefined)?.replace(/\/+$/, '') ?? '';
const BASE = DEMO ? DEMO_API : '';
const STORAGE_KEY = 'gol.auth.v1';

/** guest = เล่นโดยไม่ Login (P56) — ไม่ส่งอะไรขึ้น Server, ไม่จำข้ามการรีเฟรช */
export type AuthStatus = 'checking' | 'off' | 'signedOut' | 'signedIn' | 'guest' | 'error';

interface Saved {
  token: string;
  expiresAt: number;
  player: AuthPlayer;
}

interface AuthState {
  status: AuthStatus;
  player: AuthPlayer | null;
  token: string | null;
  /** ข้อความเมื่อเชื่อมต่อระบบบัญชีไม่ได้ (status = error) */
  message: string | null;
}

export const useAuthStore = create<AuthState>(() => ({ status: 'checking', player: null, token: null, message: null }));

function readSaved(): Saved | null {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as Saved) : null;
    return saved && typeof saved.token === 'string' && saved.expiresAt > Date.now() ? saved : null;
  } catch {
    return null;
  }
}

function writeSaved(saved: Saved | null): void {
  try {
    if (saved) globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(saved));
    else globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // เบราว์เซอร์ปิด Storage — ใช้ได้จนปิดหน้าเว็บ
  }
}

/** fetch ไป Server ของระบบบัญชี (Demo = VITE_ACCOUNTS_API, ปกติ = Server เดิม) */
export const authFetch = (path: string, init?: RequestInit) => fetch(`${BASE}${path}`, init);

/** ตรวจว่าระบบบัญชีเปิดไหม และ Token ที่เก็บไว้ยังใช้ได้ไหม */
export async function initAuth(): Promise<void> {
  if (DEMO && !DEMO_API) return useAuthStore.setState({ status: 'off' });
  useAuthStore.setState({ status: 'checking', message: null });
  try {
    const res = await authFetch('/api/auth/config');
    // Server รุ่นก่อน W2 ไม่มีเส้นทางนี้ = ไม่มีระบบบัญชี
    const config: AuthConfig = res.ok ? ((await res.json()) as AuthConfig) : { enabled: false };
    if (!config.enabled) return useAuthStore.setState({ status: 'off' });
    const saved = readSaved();
    if (saved) {
      const me = await authFetch('/api/auth/me', { headers: { authorization: `Bearer ${saved.token}` } });
      if (me.ok) {
        const { player } = (await me.json()) as { player: AuthPlayer };
        return useAuthStore.setState({ status: 'signedIn', player, token: saved.token });
      }
      writeSaved(null);
    }
    useAuthStore.setState({ status: 'signedOut', player: null, token: null });
  } catch {
    useAuthStore.setState({ status: 'error', message: 'เชื่อมต่อระบบบัญชีไม่ได้ (Server อาจกำลังเริ่มทำงาน รอสักครู่แล้วลองใหม่)' });
  }
}

/** คืน null เมื่อสำเร็จ หรือข้อความ Error ภาษาไทย */
async function submit(path: string, body: LoginRequest | RegisterRequest): Promise<string | null> {
  try {
    const res = await authFetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = (await res.json()) as AuthResponse | AuthError;
    if (!res.ok || 'error' in data) return 'error' in data ? data.error : `HTTP ${res.status}`;
    writeSaved({ token: data.token, expiresAt: data.expiresAt, player: data.player });
    useAuthStore.setState({ status: 'signedIn', player: data.player, token: data.token, message: null });
    return null;
  } catch {
    return 'เชื่อมต่อ Server ไม่ได้ ลองใหม่อีกครั้ง';
  }
}

export const login = (body: LoginRequest) => submit('/api/auth/login', body);
export const register = (body: RegisterRequest) => submit('/api/auth/register', body);

/** P56 / SPEC § 4.47: เล่นโดยไม่ Login — ไม่บันทึกอะไร */
export function playAsGuest(): void {
  writeSaved(null);
  useAuthStore.setState({ status: 'guest', player: null, token: null, message: null });
}

export function logout(): void {
  writeSaved(null);
  useAuthStore.setState({ status: 'signedOut', player: null, token: null });
}
