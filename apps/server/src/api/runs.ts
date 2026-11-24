import type { FastifyInstance } from 'fastify';
import { RunLogUpload, type RunSubmitResponse } from '@gol/shared';
import { checkRun } from '../accounts/plausibility';
import { authenticate, type Accounts } from './auth';
import { playerRank } from './leaderboard';

/**
 * W4 / SPEC § 4.41: Web ส่ง Log ของรอบขึ้น Server (ต้อง Login)
 * W5 / SPEC § 4.42: จบรอบส่งผลรอบมาด้วย → ตรวจความสมเหตุสมผล แล้วบันทึกคะแนน (ไม่ผ่าน = ไม่นับอันดับ)
 */
export function registerRunRoutes(app: FastifyInstance, accounts: Accounts | null): void {
  if (!accounts) return;
  // Log 5,000 เหตุการณ์ ≈ 1 MB — เผื่อไว้ 2 MB
  app.post('/api/runs/log', { bodyLimit: 2 * 1024 * 1024 }, async (req, reply) => {
    const player = await authenticate(accounts, req);
    if (!player) return reply.code(401).send({ error: 'กรุณาเข้าสู่ระบบใหม่', code: 'unauthorized' });
    const parsed = RunLogUpload.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Log ไม่ถูกต้อง', code: 'invalid' });
    const { runId, levelId, events, result } = parsed.data;
    const check = result ? checkRun(levelId, result, events, accounts.now()) : null;
    const saved = await accounts.store.saveRun(
      { playerId: player.id, runId, levelId, events },
      result && check
        ? {
            status: result.status,
            score: result.score,
            stars: result.stars,
            biomassG: result.yieldG,
            simSeconds: result.elapsedS,
            realSeconds: check.realSeconds,
            gameVersion: result.gameVersion,
            ranked: check.reasons.length === 0,
            rejectReason: check.reasons.length ? check.reasons.join(',') : null,
          }
        : undefined,
    );
    if (!saved) return reply.code(409).send({ error: 'ส่งผลรอบนี้ไปแล้ว', code: 'duplicate_run' });
    const ranked = check !== null && check.reasons.length === 0;
    // W6: รอบชนะที่นับ → บอกอันดับปัจจุบันของผู้เล่นในด่านนี้ (ใช้รอบดีที่สุด)
    const rank = ranked && result?.status === 'won' ? await playerRank(accounts, levelId, player.id) : null;
    const body: RunSubmitResponse = { saved: events.length, score: check ? { ranked, reasons: check.reasons, rank } : null };
    return reply.code(201).send(body);
  });
}
