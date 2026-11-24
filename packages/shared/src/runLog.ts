import { z } from 'zod';

/** Log การเล่นต่อรอบ (W4 / SPEC § 4.41) — Web ส่งขึ้น Server เมื่อ Login อยู่ */

export const RUN_LOG_MAX_EVENTS = 5000;
export const RUN_LOG_MAX_MESSAGE = 300;
/** แถวท้ายที่ Web เติมเมื่อผู้เล่นออกกลางคัน */
export const RUN_ABANDONED_KIND = 'run.abandoned';

export const RunLogEvent = z.object({
  at: z.number().int().nonnegative(),
  simTimeS: z.number().finite(),
  kind: z.string().min(1).max(64),
  severity: z.enum(['info', 'warning', 'critical']),
  message: z.string().max(RUN_LOG_MAX_MESSAGE),
  plantId: z.number().int().optional(),
  value: z.union([z.number().finite(), z.string().max(32)]).optional(),
});
export type RunLogEvent = z.infer<typeof RunLogEvent>;

/** W5 (SPEC § 4.42): ผลรอบที่ส่งมาพร้อม Log เมื่อจบรอบ — Server ตรวจความสมเหตุสมผล */
export const RunResult = z.object({
  status: z.enum(['won', 'lost']),
  score: z.number().finite(),
  stars: z.number().int().min(0).max(3),
  /** น้ำหนักรวมที่เก็บเกี่ยว (g) — แพ้ = 0 */
  yieldG: z.number().finite().nonnegative(),
  /** เวลาจำลองที่ใช้ (s) */
  elapsedS: z.number().finite(),
  /** เคยใช้ Mock PLC Auto ขณะเล่น */
  testRun: z.boolean(),
  gameVersion: z.string().max(40),
});
export type RunResult = z.infer<typeof RunResult>;

export const RunLogUpload = z.object({
  /** UUID สุ่มฝั่ง Web ต่อรอบ */
  runId: z.string().regex(/^[0-9a-f-]{16,64}$/i),
  /** id ของด่าน หรือ "free" (Free Play) */
  levelId: z.string().min(1).max(32),
  events: z.array(RunLogEvent).min(1).max(RUN_LOG_MAX_EVENTS),
  /** มีเมื่อจบรอบ (ชนะ/แพ้) — ออกกลางคันไม่มี */
  result: RunResult.optional(),
});

/** W6 (SPEC § 4.43): ตารางอันดับ — ไม่มีรหัสเชิญ (เป็นความลับที่ใช้สมัคร) */
export type LeaderboardScope = 'all' | 'group';

export interface LeaderboardRow {
  rank: number;
  username: string;
  score: number;
  stars: number;
  yieldG: number;
  realSeconds: number;
  /** เวลาที่ส่ง (ISO) */
  at: string;
  me: boolean;
}

export interface Leaderboard {
  levelId: string;
  scope: LeaderboardScope;
  rows: LeaderboardRow[];
  /** แถวของฉัน (null = ยังไม่มีรอบชนะที่นับในด่านนี้) */
  me: LeaderboardRow | null;
}

export interface MyLevelScore {
  levelId: string;
  bestScore: number | null;
  bestStars: number | null;
  wins: number;
  rounds: number;
}

/** ผลการส่งรอบที่ Web ได้กลับมา (W5/W6) */
export interface RunSubmitResponse {
  saved: number;
  score: { ranked: boolean; reasons: ScoreRejectReason[]; rank: number | null } | null;
}

/** เหตุผลที่ไม่นับอันดับ (W5) */
export type ScoreRejectReason =
  | 'not_level'
  | 'test_run'
  | 'score_range'
  | 'result_mismatch'
  | 'yield_below_target'
  | 'time_over_limit'
  | 'too_fast'
  | 'log_incomplete'
  | 'future_time';

export const SCORE_REJECT_TEXT: Record<ScoreRejectReason, string> = {
  not_level: 'ไม่ใช่ด่าน (Free Play)',
  test_run: 'รอบทดสอบ (ใช้ PLC Auto)',
  score_range: 'คะแนนเกินช่วง 0–1500',
  result_mismatch: 'ดาว/คะแนนไม่ตรงกับผลรอบ',
  yield_below_target: 'น้ำหนักไม่ถึงเป้า',
  time_over_limit: 'เวลาจำลองเกินเวลาด่าน',
  too_fast: 'เร็วกว่าความเร็วสูงสุด 1440x',
  log_incomplete: 'Log ไม่ครบ/ไม่ตรง',
  future_time: 'เวลาใน Log ล้ำเวลา Server',
};
export type RunLogUpload = z.infer<typeof RunLogUpload>;
