import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AuthResponse } from '@gol/shared';
import { buildApp } from '../src/app';
import { hashPassword, verifyPassword } from '../src/accounts/password';
import { RateLimiter } from '../src/accounts/rateLimit';
import { signToken, verifyToken } from '../src/accounts/token';
import { testConfig } from './helpers';

/** W2 / SPEC § 4.39 / AC-70 — สมัครด้วยรหัสเชิญ + Login */

const T = 30_000;
const apps: FastifyInstance[] = [];

async function accountsApp(): Promise<FastifyInstance> {
  const app = await buildApp(testConfig({ databaseUrl: 'memory://', authSecret: 'test-secret' }), { startLabs: false });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
});

let ipSeq = 0;
/** IP แยกต่อคำขอ ไม่ให้ชนขีดจำกัดต่อ IP (ยกเว้นเทสต์ที่ตั้งใจ) */
const freshIp = () => `10.0.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;

function post(app: FastifyInstance, url: string, payload: unknown, ip = freshIp()) {
  return app.inject({ method: 'POST', url, payload: payload as Record<string, unknown>, remoteAddress: ip });
}
const register = (app: FastifyInstance, username: string, inviteCode: string, password = 'password123', ip?: string) =>
  post(app, '/api/auth/register', { username, password, inviteCode }, ip);
const login = (app: FastifyInstance, username: string, password: string, ip?: string) => post(app, '/api/auth/login', { username, password }, ip);
const me = (app: FastifyInstance, token: string) => app.inject({ method: 'GET', url: '/api/auth/me', headers: { authorization: `Bearer ${token}` } });

describe('password + token + rate limiter (W2)', () => {
  it('scrypt hash verifies only the right password and is salted', async () => {
    const h1 = await hashPassword('ผักสลัด123');
    const h2 = await hashPassword('ผักสลัด123');
    expect(h1).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(h1).not.toBe(h2);
    expect(await verifyPassword('ผักสลัด123', h1)).toBe(true);
    expect(await verifyPassword('ผักสลัด124', h1)).toBe(false);
    expect(await verifyPassword('x', 'garbage')).toBe(false);
  });

  it('token: valid until expiry, rejects tampering and wrong secret', () => {
    const { token, expiresAt } = signToken('s', 7, 'hash', 1000);
    expect(verifyToken('s', token, 1000)).toMatchObject({ p: 7 });
    expect(verifyToken('s', token, expiresAt)).toBeNull();
    expect(verifyToken('other', token, 1000)).toBeNull();
    const [body, mac] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body!, 'base64url').toString()), p: 8 })).toString('base64url');
    expect(verifyToken('s', `${forged}.${mac}`, 1000)).toBeNull();
    expect(verifyToken('s', 'not-a-token', 1000)).toBeNull();
  });

  it('rate limiter blocks after the limit and frees after the window', () => {
    let t = 0;
    const rl = new RateLimiter(2, 1000, () => t);
    rl.hit('a');
    expect(rl.retryAfterS('a')).toBe(0);
    rl.hit('a');
    expect(rl.retryAfterS('a')).toBe(1);
    expect(rl.retryAfterS('b')).toBe(0);
    t = 1000;
    expect(rl.retryAfterS('a')).toBe(0);
  });
});

describe('auth API (W2 / SPEC § 4.39)', () => {
  it('accounts are off without DATABASE_URL', async () => {
    const app = await buildApp(testConfig(), { startLabs: false });
    apps.push(app);
    expect((await app.inject({ method: 'GET', url: '/api/auth/config' })).json()).toEqual({ enabled: false });
    expect((await register(app, 'alice', 'X')).statusCode).toBe(404);
  });

  it('invite max 3: three register, the fourth is refused; token works for /me', async () => {
    const app = await accountsApp();
    expect((await app.inject({ method: 'GET', url: '/api/auth/config' })).json()).toEqual({ enabled: true });
    await app.accounts!.store.createInvite({ code: 'GO-TEST-0003', maxUses: 3 });
    const tokens: string[] = [];
    for (const name of ['alice', 'bobby', 'carol']) {
      const res = await register(app, name, ' go-test-0003 ');
      expect(res.statusCode).toBe(201);
      const body = res.json<AuthResponse>();
      expect(body.player).toMatchObject({ username: name, inviteCode: 'GO-TEST-0003' });
      expect(body).not.toHaveProperty('player.passwordHash');
      tokens.push(body.token);
    }
    const fourth = await register(app, 'dave', 'GO-TEST-0003');
    expect(fourth.statusCode).toBe(403);
    expect(fourth.json()).toMatchObject({ code: 'invite_full' });
    expect((await me(app, tokens[1]!)).json()).toEqual({ player: expect.objectContaining({ username: 'bobby' }) });
  }, T);

  it('10 simultaneous registrations on a max-3 invite → exactly 3 succeed', async () => {
    const app = await accountsApp();
    await app.accounts!.store.createInvite({ code: 'RACE', maxUses: 3 });
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => register(app, `racer${i}`, 'RACE')));
    expect(results.filter((r) => r.statusCode === 201)).toHaveLength(3);
    expect(results.filter((r) => r.statusCode === 403)).toHaveLength(7);
    expect((await app.accounts!.store.getInvite('RACE'))!.usedCount).toBe(3);
  }, T);

  it('rejects taken ID, unknown/closed invite and bad formats', async () => {
    const app = await accountsApp();
    const { store } = app.accounts!;
    await store.createInvite({ code: 'OPEN', maxUses: 10 });
    await store.createInvite({ code: 'CLOSED', maxUses: 10 });
    await store.setInviteActive('CLOSED', false);
    expect((await register(app, 'Alice_01', 'OPEN')).json()).toMatchObject({ player: { username: 'alice_01' } });
    expect((await register(app, 'alice_01', 'OPEN')).json()).toMatchObject({ code: 'username_taken' });
    expect((await register(app, 'alice_01', 'OPEN')).statusCode).toBe(409);
    expect((await register(app, 'newbie', 'NOPE')).json()).toMatchObject({ code: 'invite_not_found' });
    expect((await register(app, 'newbie', 'CLOSED')).json()).toMatchObject({ code: 'invite_inactive' });
    for (const [username, password] of [['abc', 'password123'], ['สมชาย', 'password123'], ['bad name', 'password123'], ['goodname', 'short']]) {
      const res = await register(app, username!, 'OPEN', password);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'invalid' });
    }
    expect((await post(app, '/api/auth/register', { username: 'x' })).statusCode).toBe(400);
    expect((await store.getInvite('OPEN'))!.usedCount).toBe(1);
  }, T);

  it('login: right password works, wrong one gets one generic message', async () => {
    const app = await accountsApp();
    await app.accounts!.store.createInvite({ code: 'C', maxUses: 5 });
    await register(app, 'alice', 'C', 'correct-horse');
    const ok = await login(app, 'ALICE ', 'correct-horse');
    expect(ok.statusCode).toBe(200);
    expect((await me(app, ok.json<AuthResponse>().token)).statusCode).toBe(200);
    const wrong = await login(app, 'alice', 'wrong-horse');
    const nobody = await login(app, 'nobody', 'whatever1');
    expect(wrong.statusCode).toBe(401);
    expect(nobody.statusCode).toBe(401);
    expect(wrong.json()).toEqual(nobody.json());
  }, T);

  it('/me rejects missing, forged and post-password-change tokens', async () => {
    const app = await accountsApp();
    const { store } = app.accounts!;
    await store.createInvite({ code: 'C', maxUses: 5 });
    const { token, player } = (await register(app, 'alice', 'C')).json<AuthResponse>();
    expect((await app.inject({ method: 'GET', url: '/api/auth/me' })).statusCode).toBe(401);
    expect((await me(app, `${token}x`)).statusCode).toBe(401);
    const foreign = signToken('another-secret', player.id, 'x', Date.now()).token;
    expect((await me(app, foreign)).statusCode).toBe(401);
    await store.setPasswordHash(player.id, await hashPassword('new-password'));
    expect((await me(app, token)).statusCode).toBe(401);
    await store.deletePlayer(player.id);
    expect((await me(app, (await login(app, 'alice', 'new-password')).json<AuthResponse>().token ?? 'x')).statusCode).toBe(401);
  }, T);

  it('too many wrong logins → 429 (per ID and per IP)', async () => {
    const app = await accountsApp();
    await app.accounts!.store.createInvite({ code: 'C', maxUses: 5 });
    await register(app, 'alice', 'C', 'correct-horse');
    for (let i = 0; i < 5; i++) expect((await login(app, 'alice', `wrong-${i}xx`)).statusCode).toBe(401);
    const blocked = await login(app, 'alice', 'correct-horse');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json<{ retryAfterS: number }>().retryAfterS).toBeGreaterThan(0);
    expect(blocked.headers['retry-after']).toBeDefined();

    const ip = '192.168.1.50';
    for (let i = 0; i < 10; i++) await login(app, `guess${i}`, 'whatever1', ip);
    expect((await login(app, 'someone', 'whatever1', ip)).statusCode).toBe(429);
  }, T);

  it('registration attempts are limited per IP (guessing invite codes)', async () => {
    const app = await accountsApp();
    const ip = '192.168.1.99';
    for (let i = 0; i < 20; i++) expect((await register(app, `guess${i}`, `CODE${i}`, 'password123', ip)).statusCode).toBe(403);
    expect((await register(app, 'guess99', 'CODE99', 'password123', ip)).statusCode).toBe(429);
  }, T);
});
