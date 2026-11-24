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

export const RunLogUpload = z.object({
  /** UUID สุ่มฝั่ง Web ต่อรอบ */
  runId: z.string().regex(/^[0-9a-f-]{16,64}$/i),
  /** id ของด่าน หรือ "free" (Free Play) */
  levelId: z.string().min(1).max(32),
  events: z.array(RunLogEvent).min(1).max(RUN_LOG_MAX_EVENTS),
});
export type RunLogUpload = z.infer<typeof RunLogUpload>;
