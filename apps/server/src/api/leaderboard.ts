import type { FastifyInstance } from 'fastify';
import type { Leaderboard, LeaderboardScope } from '@gol/shared';
import { authenticate, type Accounts } from './auth';

/** W6 / SPEC § 4.43: ตารางอันดับ + คะแนนของฉัน (ต้อง Login) */

export const LEADERBOARD_LIMIT = 50;

/** อันดับของผู้เล่นในด่าน (ทุกคน) — null = ยังไม่มีรอบชนะที่นับ */
export async function playerRank(accounts: Accounts, levelId: string, playerId: number): Promise<number | null> {
  const rows = await accounts.store.leaderboard(levelId, { limit: 0, meId: playerId });
  return rows[0]?.rank ?? null;
}

export function registerLeaderboardRoutes(app: FastifyInstance, accounts: Accounts | null): void {
  if (!accounts) return;

  app.get<{ Querystring: { level?: string; scope?: string } }>('/api/leaderboard', async (req, reply) => {
    const player = await authenticate(accounts, req);
    if (!player) return reply.code(401).send({ error: 'กรุณาเข้าสู่ระบบใหม่', code: 'unauthorized' });
    const levelId = (req.query.level ?? '').trim();
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(levelId)) return reply.code(400).send({ error: 'ระบุด่าน เช่น ?level=L1', code: 'invalid' });
    const scope: LeaderboardScope = req.query.scope === 'group' ? 'group' : 'all';
    const rows = await accounts.store.leaderboard(levelId, {
      limit: LEADERBOARD_LIMIT,
      meId: player.id,
      ...(scope === 'group' ? { inviteCode: player.inviteCode } : {}),
    });
    const all = rows.map(({ playerId, ...r }) => ({ ...r, me: playerId === player.id }));
    const body: Leaderboard = {
      levelId,
      scope,
      rows: all.filter((r) => r.rank <= LEADERBOARD_LIMIT),
      me: all.find((r) => r.me) ?? null,
    };
    return body;
  });

  app.get('/api/me/scores', async (req, reply) => {
    const player = await authenticate(accounts, req);
    if (!player) return reply.code(401).send({ error: 'กรุณาเข้าสู่ระบบใหม่', code: 'unauthorized' });
    return accounts.store.myScores(player.id);
  });
}
