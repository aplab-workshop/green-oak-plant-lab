import { authFetch } from '../store/authStore';

/**
 * Admin API สำหรับหน้าครู (W8 / SPEC § 4.45) — เส้นทางเดียวกับ `npm run admin`
 * Key อยู่ใน sessionStorage เท่านั้น (ปิดแท็บ = หาย) ไม่ใส่ใน URL/localStorage
 */

const KEY_STORAGE = 'gol.admin.key';

export function readAdminKey(): string | null {
  try {
    return globalThis.sessionStorage?.getItem(KEY_STORAGE) ?? null;
  } catch {
    return null;
  }
}

export function saveAdminKey(key: string | null): void {
  try {
    if (key) globalThis.sessionStorage?.setItem(KEY_STORAGE, key);
    else globalThis.sessionStorage?.removeItem(KEY_STORAGE);
  } catch {
    // Storage ปิด — ใช้ได้จนรีเฟรชหน้า
  }
}

export class AdminError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

let currentKey: string | null = readAdminKey();
export const setCurrentKey = (key: string | null) => {
  currentKey = key;
  saveAdminKey(key);
};

export async function adminRequest(method: string, path: string, body?: unknown, key = currentKey): Promise<Response> {
  if (!key) throw new AdminError('ยังไม่ได้ใส่ Admin key', 401);
  let res: Response;
  try {
    res = await authFetch(path, {
      method,
      headers: { authorization: `Bearer ${key}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new AdminError('ติดต่อ Server ไม่ได้ (Server อาจกำลังตื่น รอสักครู่แล้วลองใหม่)', 0);
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new AdminError(data.error ?? `HTTP ${res.status}`, res.status);
  }
  return res;
}

export const adminJson = async <T>(method: string, path: string, body?: unknown): Promise<T> =>
  (await (await adminRequest(method, path, body)).json()) as T;

/** สตริงค้นหาจากตัวกรองที่มีค่า */
export function query(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString();
  return q ? `?${q}` : '';
}

export interface InviteRow {
  code: string;
  maxUses: number;
  usedCount: number;
  active: boolean;
  note: string | null;
  createdAt: string;
}

export interface PlayerRow {
  id: number;
  username: string;
  inviteCode: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface ScoreAdminRow {
  id: number;
  username: string;
  inviteCode: string;
  levelId: string;
  status: 'won' | 'lost';
  score: number;
  stars: number;
  biomassG: number;
  realSeconds: number;
  ranked: boolean;
  rejectReason: string | null;
  createdAt: string;
}

export interface StatsRow {
  invites: number;
  players: number;
  scores: number;
  runLogs: number;
  databaseBytes: number;
}

export const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-';

export const minSec = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
