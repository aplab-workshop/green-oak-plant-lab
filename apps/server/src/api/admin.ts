import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { PASSWORD_MAX, PASSWORD_MIN, normalizeInviteCode, normalizeUsername } from '@gol/shared';
import { buildRunLogCsv } from '../accounts/csv';
import { randomInviteCode, randomTempPassword } from '../accounts/inviteCode';
import { hashPassword } from '../accounts/password';
import { RateLimiter } from '../accounts/rateLimit';
import type { Accounts } from './auth';

/**
 * Admin API ของครู (W3 / SPEC § 4.40) — ใช้ผ่าน `npm run admin` (apps/server/src/admin/cli.ts)
 * ต้องส่ง `Authorization: Bearer <ADMIN_KEY>`
 */

export const ADMIN_KEY_MIN = 16;

const InviteCreate = z.object({
  maxUses: z.number().int().min(1).max(100_000),
  note: z.string().trim().max(200).optional(),
  code: z.string().transform(normalizeInviteCode).pipe(z.string().regex(/^[A-Z0-9-]{3,32}$/, 'รหัสใช้ A–Z, 0–9 และ - ยาว 3–32 ตัว')).optional(),
});
const InviteActive = z.object({ active: z.boolean() });
const ResetPassword = z.object({ password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX).optional() });

const sha = (s: string) => createHash('sha256').update(s).digest();

export function registerAdminRoutes(app: FastifyInstance, accounts: Accounts | null, adminKey: string | undefined): void {
  const enabled = accounts !== null && adminKey !== undefined && adminKey.length >= ADMIN_KEY_MIN;
  const expected = enabled ? sha(adminKey) : null;
  const wrongKey = new RateLimiter(10, 15 * 60_000, accounts?.now ?? Date.now);

  const guard = async (req: FastifyRequest, reply: FastifyReply) => {
    if (!accounts) return reply.code(403).send({ error: 'ระบบบัญชีปิดอยู่ (Server ไม่ได้ตั้ง DATABASE_URL)' });
    if (!expected) return reply.code(403).send({ error: `Admin API ปิดอยู่ — ตั้ง ADMIN_KEY (ยาวอย่างน้อย ${ADMIN_KEY_MIN} ตัว) บน Server` });
    const wait = wrongKey.retryAfterS(req.ip);
    if (wait) return reply.code(429).header('retry-after', String(wait)).send({ error: `ใส่ Admin key ผิดหลายครั้ง รออีก ${Math.ceil(wait / 60)} นาที` });
    const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
    if (!m || !timingSafeEqual(sha(m[1]!), expected)) {
      wrongKey.hit(req.ip);
      return reply.code(401).send({ error: 'Admin key ไม่ถูกต้อง' });
    }
  };

  app.register(async (admin) => {
    admin.addHook('onRequest', guard);
    const store = () => accounts!.store;
    const bad = (reply: FastifyReply, err: z.ZodError) => reply.code(400).send({ error: err.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' });

    admin.get('/api/admin/stats', async () => store().stats());

    admin.get('/api/admin/invites', async () => store().listInvites());

    admin.post('/api/admin/invites', async (req, reply) => {
      const parsed = InviteCreate.safeParse(req.body);
      if (!parsed.success) return bad(reply, parsed.error);
      const { maxUses, note, code } = parsed.data;
      // สุ่มซ้ำได้ยากมาก แต่ลองใหม่ไว้กันพลาด
      for (let i = 0; i < (code ? 1 : 5); i++) {
        const invite = await store().createInvite({ code: code ?? randomInviteCode(), maxUses, ...(note ? { note } : {}) });
        if (invite) return reply.code(201).send(invite);
      }
      return reply.code(409).send({ error: `มีรหัส ${code} อยู่แล้ว` });
    });

    admin.patch<{ Params: { code: string } }>('/api/admin/invites/:code', async (req, reply) => {
      const parsed = InviteActive.safeParse(req.body);
      if (!parsed.success) return bad(reply, parsed.error);
      const code = normalizeInviteCode(req.params.code);
      if (!(await store().setInviteActive(code, parsed.data.active))) return reply.code(404).send({ error: `ไม่พบรหัสเชิญ ${code}` });
      return store().getInvite(code);
    });

    /** ?dryRun=1 = นับอย่างเดียว ไม่ลบ */
    admin.delete<{ Params: { code: string }; Querystring: { dryRun?: string; withAccounts?: string } }>(
      '/api/admin/invites/:code/data',
      async (req, reply) => {
        const code = normalizeInviteCode(req.params.code);
        if (!(await store().getInvite(code))) return reply.code(404).send({ error: `ไม่พบรหัสเชิญ ${code}` });
        const withAccounts = req.query.withAccounts === '1';
        if (req.query.dryRun === '1') {
          const n = await store().countInviteData(code);
          return { dryRun: true, withAccounts, ...n, players: withAccounts ? n.players : 0 };
        }
        return { dryRun: false, withAccounts, ...(await store().deleteInviteData(code, withAccounts)) };
      },
    );

    /** W4: CSV ของ Log การเล่น กรองตามรหัสเชิญ/ผู้เล่น/ด่าน */
    admin.get<{ Querystring: { invite?: string; player?: string; level?: string } }>('/api/admin/logs.csv', async (req, reply) => {
      const { invite, player, level } = req.query;
      const logs = await store().listRunLogs({
        ...(invite ? { inviteCode: normalizeInviteCode(invite) } : {}),
        ...(player ? { username: normalizeUsername(player) } : {}),
        ...(level ? { levelId: level.trim() } : {}),
      });
      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('x-run-count', String(logs.length))
        .send(buildRunLogCsv(logs));
    });

    admin.get<{ Querystring: { invite?: string } }>('/api/admin/players', async (req) =>
      store().listPlayers(req.query.invite ? normalizeInviteCode(req.query.invite) : undefined),
    );

    admin.post<{ Params: { username: string } }>('/api/admin/players/:username/password', async (req, reply) => {
      const parsed = ResetPassword.safeParse(req.body ?? {});
      if (!parsed.success) return reply.code(400).send({ error: `Password ยาว ${PASSWORD_MIN}–${PASSWORD_MAX} ตัว` });
      const username = normalizeUsername(req.params.username);
      const player = await store().getPlayerForLogin(username);
      if (!player) return reply.code(404).send({ error: `ไม่พบผู้เล่น ${username}` });
      const password = parsed.data.password ?? randomTempPassword();
      await store().setPasswordHash(player.id, await hashPassword(password));
      return { username, password };
    });

    admin.delete<{ Params: { username: string } }>('/api/admin/players/:username', async (req, reply) => {
      const username = normalizeUsername(req.params.username);
      const player = await store().getPlayerForLogin(username);
      if (!player || !(await store().deletePlayer(player.id))) return reply.code(404).send({ error: `ไม่พบผู้เล่น ${username}` });
      return { deleted: username };
    });
  });
}
