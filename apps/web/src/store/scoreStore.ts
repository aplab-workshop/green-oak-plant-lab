import { create } from 'zustand';
import type { Leaderboard, LeaderboardScope, MyLevelScore, RunSubmitResponse } from '@gol/shared';
import { authFetch, useAuthStore } from './authStore';

/**
 * คะแนนบน Server (W6 / SPEC § 4.43) — คะแนนของฉัน, ผลการส่งรอบล่าสุด, ตารางอันดับ
 */

interface ScoreState {
  /** null = ยังไม่โหลด / ไม่ได้ Login */
  myScores: MyLevelScore[] | null;
  /** ผลการส่งรอบล่าสุด ผูกกับรอบของ Lab (`labId:runId`) */
  lastSubmit: { round: string; response: RunSubmitResponse } | null;
}

export const useScoreStore = create<ScoreState>(() => ({ myScores: null, lastSubmit: null }));

function authHeaders(): Record<string, string> | null {
  const { status, token } = useAuthStore.getState();
  return status === 'signedIn' && token ? { authorization: `Bearer ${token}` } : null;
}

export async function refreshMyScores(): Promise<void> {
  const headers = authHeaders();
  if (!headers) return useScoreStore.setState({ myScores: null });
  try {
    const res = await authFetch('/api/me/scores', { headers });
    if (res.ok) useScoreStore.setState({ myScores: (await res.json()) as MyLevelScore[] });
  } catch {
    // ออฟไลน์ — แสดงค่าเดิมไว้
  }
}

/** คืน null เมื่อไม่ได้ Login หรือโหลดไม่สำเร็จ */
export async function fetchLeaderboard(levelId: string, scope: LeaderboardScope): Promise<Leaderboard | null> {
  const headers = authHeaders();
  if (!headers) return null;
  try {
    const res = await authFetch(`/api/leaderboard?level=${encodeURIComponent(levelId)}&scope=${scope}`, { headers });
    return res.ok ? ((await res.json()) as Leaderboard) : null;
  } catch {
    return null;
  }
}

/** เรียกจาก runLogUploader เมื่อ Server ตอบผลการส่งรอบ */
export function recordSubmit(round: string, response: RunSubmitResponse): void {
  useScoreStore.setState({ lastSubmit: { round, response } });
  if (response.score) void refreshMyScores();
}

// ออกจากระบบ/เปลี่ยนบัญชี → ล้างคะแนนของคนก่อน
useAuthStore.subscribe((s, prev) => {
  if (s.player?.id !== prev.player?.id) useScoreStore.setState({ myScores: null, lastSubmit: null });
});
