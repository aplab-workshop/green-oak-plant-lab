import { LEVELS, makeConfig } from '@gol/sim-core';
import { uiSpeeds, type RunLogEvent, type RunResult, type ScoreRejectReason } from '@gol/shared';

/**
 * ตรวจความสมเหตุสมผลของผลรอบ (W5 / SPEC § 4.42) — ไม่เล่นซ้ำ (D2) ดูแค่ว่าตัวเลขเป็นไปได้
 * คืนเหตุผลที่ไม่ผ่าน (ว่าง = นับอันดับ) และเวลาจริงที่ใช้ (s) จาก Log
 */

const GAME = makeConfig().game;
export const SCORE_MAX = GAME.maxScore + GAME.harvestBonus;
/** เผื่อเวลาจำลองเกินด่านได้ 1 ชม. (tick สุดท้าย) */
const TIME_LIMIT_SLACK_S = 3600;
/** เผื่อความคลาดเคลื่อนของการวัดเวลาจริง */
const SPEED_TOLERANCE = 0.9;
const SPEED_SLACK_S = 2;
const FUTURE_SLACK_MS = 5 * 60_000;

export interface PlausibilityResult {
  reasons: ScoreRejectReason[];
  realSeconds: number;
}

export function checkRun(levelId: string, result: RunResult, events: readonly RunLogEvent[], serverNowMs: number): PlausibilityResult {
  const reasons = new Set<ScoreRejectReason>();
  const level = LEVELS.find((l) => l.id === levelId);
  if (!level) reasons.add('not_level');
  if (result.testRun) reasons.add('test_run');

  if (!Number.isInteger(result.score) || result.score < 0 || result.score > SCORE_MAX) reasons.add('score_range');
  if (result.status === 'lost' ? result.score !== 0 || result.stars !== 0 : result.stars < 1) reasons.add('result_mismatch');
  if (level && result.status === 'won' && result.yieldG < level.targetG) reasons.add('yield_below_target');
  if (result.elapsedS <= 0 || (level && result.elapsedS > level.timeLimitDays * 86_400 + TIME_LIMIT_SLACK_S)) reasons.add('time_over_limit');

  const start = events.find((e) => e.kind === 'game.start');
  const endKind = result.status === 'won' ? 'game.won' : 'game.over';
  const end = [...events].reverse().find((e) => e.kind === endKind);
  const realSeconds = start && end ? Math.max(0, Math.round((end.at - start.at) / 1000)) : 0;
  // เวลาจำลองใน Log ต้องตรงกับเวลาที่ส่ง (กันส่ง elapsedS น้อย ๆ เพื่อเลี่ยง too_fast)
  const logSimS = start && end ? end.simTimeS - start.simTimeS : -1;
  if (!start || !end || end.at < start.at || logSimS < 0 || Math.abs(logSimS - result.elapsedS) > TIME_LIMIT_SLACK_S || end.value !== result.score) {
    reasons.add('log_incomplete');
  }

  const maxSpeed = Math.max(...uiSpeeds(level ?? null));
  if (start && end && realSeconds < (result.elapsedS / maxSpeed) * SPEED_TOLERANCE - SPEED_SLACK_S) reasons.add('too_fast');
  if (events.some((e) => e.at > serverNowMs + FUTURE_SLACK_MS)) reasons.add('future_time');

  return { reasons: [...reasons], realSeconds };
}
