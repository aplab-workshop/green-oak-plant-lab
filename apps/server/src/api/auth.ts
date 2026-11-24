import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { LoginRequest, RegisterRequest, type AuthConfig, type AuthError, type AuthPlayer, type AuthResponse } from '@gol/shared';
import type { AccountStore, Player, PlayerWithHash, RegisterFailure } from '../accounts/AccountStore';
import { dummyHash, hashPassword, verifyPassword } from '../accounts/password';
import { RateLimiter } from '../accounts/rateLimit';
import { passwordVersion, signToken, verifyToken } from '../accounts/token';

/** API บัญชีผู้เล่น (W2 / SPEC § 4.39) */

export interface Accounts {
  store: AccountStore;
  secret: string;
  now: () => number;
}

const MIN = 60_000;

const REGISTER_FAIL: Record<RegisterFailure, { status: number; error: string }> = {
  username_taken: { status: 409, error: 'ID นี้มีคนใช้แล้ว ลองตั้ง ID อื่น' },
  invite_not_found: { status: 403, error: 'ไม่พบรหัสเชิญนี้ ตรวจรหัสจากครูอีกครั้ง' },
  invite_inactive: { status: 403, error: 'รหัสเชิญนี้ถูกปิดแล้ว' },
  invite_full: { status: 403, error: 'รหัสเชิญนี้สมัครครบจำนวนแล้ว' },
};

const publicPlayer = (p: Player): AuthPlayer => ({ id: p.id, username: p.username, inviteCode: p.inviteCode });

/** ผู้เล่นจาก `Authorization: Bearer <token>` — null = ไม่ผ่าน */
export async function authenticate(accounts: Accounts, req: FastifyRequest): Promise<PlayerWithHash | null> {
  const m = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '');
  const payload = m ? verifyToken(accounts.secret, m[1]!, accounts.now()) : null;
  if (!payload) return null;
  const player = await accounts.store.getPlayerWithHash(payload.p);
  return player && passwordVersion(player.passwordHash) === payload.v ? player : null;
}

export function registerAuthRoutes(app: FastifyInstance, accounts: Accounts | null): void {
  app.get('/api/auth/config', async (): Promise<AuthConfig> => ({ enabled: accounts !== null }));
  if (!accounts) return;
  const { store, secret, now } = accounts;

  const loginByIp = new RateLimiter(10, 15 * MIN, now);
  const loginByUser = new RateLimiter(5, 15 * MIN, now);
  const registerByIp = new RateLimiter(20, 60 * MIN, now);

  const fail = (reply: FastifyReply, status: number, body: AuthError) => reply.code(status).send(body);
  const tooMany = (reply: FastifyReply, retryAfterS: number) =>
    reply
      .header('retry-after', String(retryAfterS))
      .code(429)
      .send({ error: `ลองหลายครั้งเกินไป รออีก ${Math.ceil(retryAfterS / 60)} นาที`, code: 'rate_limited', retryAfterS } satisfies AuthError);
  const issue = (player: PlayerWithHash | (Player & { passwordHash: string })): AuthResponse => ({
    ...signToken(secret, player.id, player.passwordHash, now()),
    player: publicPlayer(player),
  });

  app.post('/api/auth/register', async (req, reply) => {
    const wait = registerByIp.retryAfterS(req.ip);
    if (wait) return tooMany(reply, wait);
    registerByIp.hit(req.ip);
    const parsed = RegisterRequest.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, { error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง', code: 'invalid' });
    const passwordHash = await hashPassword(parsed.data.password);
    const result = await store.registerPlayer({ username: parsed.data.username, passwordHash, inviteCode: parsed.data.inviteCode });
    if (!result.ok) return fail(reply, REGISTER_FAIL[result.reason].status, { error: REGISTER_FAIL[result.reason].error, code: result.reason });
    await store.touchLogin(result.player.id);
    return reply.code(201).send(issue({ ...result.player, passwordHash }));
  });

  app.post('/api/auth/login', async (req, reply) => {
    const parsed = LoginRequest.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, { error: 'กรอก ID และ Password', code: 'invalid' });
    const { username, password } = parsed.data;
    const userKey = `u:${username}`;
    const wait = Math.max(loginByIp.retryAfterS(req.ip), loginByUser.retryAfterS(userKey));
    if (wait) return tooMany(reply, wait);
    const player = await store.getPlayerForLogin(username);
    const ok = await verifyPassword(password, player?.passwordHash ?? (await dummyHash()));
    if (!player || !ok) {
      loginByIp.hit(req.ip);
      loginByUser.hit(userKey);
      return fail(reply, 401, { error: 'ID หรือ Password ไม่ถูกต้อง', code: 'bad_credentials' });
    }
    loginByUser.reset(userKey);
    await store.touchLogin(player.id);
    return issue(player);
  });

  app.get('/api/auth/me', async (req, reply) => {
    const player = await authenticate(accounts, req);
    if (!player) return fail(reply, 401, { error: 'กรุณาเข้าสู่ระบบใหม่', code: 'unauthorized' });
    return { player: publicPlayer(player) };
  });
}
