import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AuthResponse } from '@gol/shared';
import { buildApp } from '../src/app';
import { parseArgs, runAdmin } from '../src/admin/cli';
import { randomInviteCode } from '../src/accounts/inviteCode';
import type { ServerConfig } from '../src/config';
import { testConfig } from './helpers';

/** W3 / SPEC § 4.40 / AC-71 — Admin API + CLI ของครู */

const T = 30_000;
const KEY = 'teacher-key-0123456789';
const apps: FastifyInstance[] = [];

async function start(overrides: Partial<ServerConfig> = {}): Promise<{ app: FastifyInstance; url: string }> {
  const app = await buildApp(testConfig({ databaseUrl: 'memory://', authSecret: 's', adminKey: KEY, ...overrides }), { startLabs: false });
  apps.push(app);
  const url = await app.listen({ host: '127.0.0.1', port: 0 });
  return { app, url };
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
});

/** รัน CLI แล้วเก็บข้อความที่พิมพ์ */
async function cli(url: string, argv: string, key: string | undefined = KEY): Promise<{ code: number; out: string }> {
  const lines: string[] = [];
  const code = await runAdmin(argv.split(' ').filter(Boolean), { url, key }, (l) => lines.push(l));
  return { code, out: lines.join('\n') };
}

const register = (app: FastifyInstance, username: string, inviteCode: string, password = 'password123') =>
  app.inject({ method: 'POST', url: '/api/auth/register', payload: { username, password, inviteCode }, remoteAddress: `10.9.0.${username.length}` });

describe('admin tools (W3 / SPEC § 4.40)', () => {
  it('random invite codes use GO-XXXX-XXXX without confusing characters', () => {
    for (let i = 0; i < 200; i++) expect(randomInviteCode()).toMatch(/^GO-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
  });

  it('parses positional args and flags', () => {
    const a = parseArgs(['invite', 'create', '--max', '40', '--note', 'ม.5/1', '--yes']);
    expect(a.positional).toEqual(['invite', 'create']);
    expect(a.flags.get('max')).toBe('40');
    expect(a.flags.get('note')).toBe('ม.5/1');
    expect(a.flags.get('yes')).toBe(true);
  });

  it('admin API refuses missing/wrong keys, and is off without ADMIN_KEY', async () => {
    const { app } = await start();
    expect((await app.inject({ method: 'GET', url: '/api/admin/stats' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/admin/stats', headers: { authorization: 'Bearer nope' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/admin/stats', headers: { authorization: `Bearer ${KEY}` } })).statusCode).toBe(200);
    // ผิดซ้ำ ๆ จาก IP เดียว → 429
    for (let i = 0; i < 10; i++) await app.inject({ method: 'GET', url: '/api/admin/invites', headers: { authorization: `Bearer x${i}` }, remoteAddress: '10.1.1.1' });
    expect((await app.inject({ method: 'GET', url: '/api/admin/invites', headers: { authorization: `Bearer ${KEY}` }, remoteAddress: '10.1.1.1' })).statusCode).toBe(429);

    const noKey = await start({ adminKey: undefined });
    const off = await noKey.app.inject({ method: 'GET', url: '/api/admin/stats', headers: { authorization: `Bearer ${KEY}` } });
    expect(off.statusCode).toBe(403);
    const short = await start({ adminKey: 'short' });
    expect((await short.app.inject({ method: 'GET', url: '/api/admin/stats', headers: { authorization: 'Bearer short' } })).statusCode).toBe(403);
    const noDb = await start({ databaseUrl: undefined });
    expect((await noDb.app.inject({ method: 'GET', url: '/api/admin/stats', headers: { authorization: `Bearer ${KEY}` } })).statusCode).toBe(403);
  }, T);

  it('CLI without/with a wrong key fails with a Thai message', async () => {
    const { url } = await start();
    expect(await cli(url, 'invite list', '')).toMatchObject({ code: 1, out: expect.stringContaining('ADMIN_KEY') });
    expect(await cli(url, 'invite list', 'wrong-key-wrong-key')).toMatchObject({ code: 1, out: '❌ Admin key ไม่ถูกต้อง' });
    expect(await cli('http://127.0.0.1:1', 'stats')).toMatchObject({ code: 1, out: expect.stringContaining('ติดต่อ Server') });
    expect((await cli(url, '')).code).toBe(0);
    expect((await cli(url, 'nonsense')).code).toBe(1);
  }, T);

  it('invite create/list/close/open through the CLI', async () => {
    const { app, url } = await start();
    const made = await cli(url, 'invite create --max 40');
    expect(made.code).toBe(0);
    const code = /GO-[A-Z0-9]{4}-[A-Z0-9]{4}/.exec(made.out)![0];
    expect(await cli(url, 'invite create --max 3 --code room-51')).toMatchObject({ code: 0, out: expect.stringContaining('ROOM-51') });
    expect(await cli(url, 'invite create --max 3 --code ROOM-51')).toMatchObject({ code: 1, out: expect.stringContaining('มีรหัส ROOM-51') });
    expect((await cli(url, 'invite create --max 0')).code).toBe(1);

    await register(app, 'alice', code);
    const list = await cli(url, 'invite list');
    expect(list.out).toMatch(new RegExp(`${code}\\s+1/40\\s+เปิด`));
    expect(list.out).toMatch(/ROOM-51\s+0\/3/);

    expect((await cli(url, 'invite close room-51')).code).toBe(0);
    expect((await register(app, 'bobby', 'ROOM-51')).json()).toMatchObject({ code: 'invite_inactive' });
    expect((await cli(url, 'invite open ROOM-51')).code).toBe(0);
    expect((await register(app, 'bobby', 'ROOM-51')).statusCode).toBe(201);
    expect(await cli(url, 'invite close NOPE')).toMatchObject({ code: 1, out: expect.stringContaining('ไม่พบรหัสเชิญ NOPE') });
  }, T);

  it('player list / reset-password / delete', async () => {
    const { app, url } = await start();
    await app.accounts!.store.createInvite({ code: 'A', maxUses: 5 });
    await app.accounts!.store.createInvite({ code: 'B', maxUses: 5 });
    const { token } = (await register(app, 'alice', 'A', 'old-password')).json<AuthResponse>();
    await register(app, 'bobby', 'B');

    const all = await cli(url, 'player list');
    expect(all.out).toContain('alice');
    expect(all.out).toContain('รวม 2 คน');
    expect((await cli(url, 'player list --invite b')).out).not.toContain('alice');

    const reset = await cli(url, 'player reset-password ALICE');
    const temp = /: ([a-z0-9]{10})$/m.exec(reset.out)![1]!;
    const login = (password: string) => app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'alice', password } });
    expect((await login('old-password')).statusCode).toBe(401);
    expect((await login(temp)).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(401);
    expect((await cli(url, 'player reset-password alice --password chosen-pass')).code).toBe(0);
    expect((await login('chosen-pass')).statusCode).toBe(200);
    expect((await cli(url, 'player reset-password alice --password short')).code).toBe(1);

    expect(await cli(url, 'player delete bobby')).toMatchObject({ code: 1, out: expect.stringContaining('--yes') });
    expect((await app.accounts!.store.listPlayers()).length).toBe(2);
    expect((await cli(url, 'player delete bobby --yes')).code).toBe(0);
    expect((await app.accounts!.store.listPlayers()).map((p) => p.username)).toEqual(['alice']);
    expect((await cli(url, 'player delete ghost --yes')).code).toBe(1);
  }, T);

  it('data delete by invite: dry run first, then delete; --with-accounts also removes players', async () => {
    const { app, url } = await start();
    const { store } = app.accounts!;
    await store.createInvite({ code: 'TERM1', maxUses: 5 });
    await store.createInvite({ code: 'TERM2', maxUses: 5 });
    const ids: number[] = [];
    for (const [name, code] of [['alice', 'TERM1'], ['bobby', 'TERM1'], ['carol', 'TERM2']] as const) {
      ids.push((await register(app, name, code)).json<AuthResponse>().player.id);
    }
    for (const id of ids) {
      await store.insertScore({ playerId: id, runId: 'r1', levelId: 'L1', status: 'won', score: 900, stars: 3, biomassG: 9, simSeconds: 1, realSeconds: 1, gameVersion: 't', ranked: true, rejectReason: null });
      await store.insertRunLog({ playerId: id, runId: 'r1', levelId: 'L1', events: [] });
    }

    const dry = await cli(url, 'data delete --invite term1');
    expect(dry).toMatchObject({ code: 1, out: expect.stringContaining('คะแนน 2 รอบ, Log 2 รอบ') });
    expect(await store.listScores()).toHaveLength(3);

    expect(await cli(url, 'data delete --invite term1 --yes')).toMatchObject({ code: 0, out: expect.stringContaining('ลบของรหัส TERM1 แล้ว') });
    expect((await store.listScores()).map((s) => s.username)).toEqual(['carol']);
    expect(await store.listPlayers('TERM1')).toHaveLength(2);

    expect((await cli(url, 'data delete --invite TERM2 --with-accounts')).out).toContain('บัญชี 1 คน');
    expect((await cli(url, 'data delete --invite TERM2 --with-accounts --yes')).code).toBe(0);
    expect(await store.listPlayers('TERM2')).toEqual([]);
    expect(await store.listRunLogs()).toEqual([]);
    expect((await store.getInvite('TERM2'))!.usedCount).toBe(1);
    expect((await cli(url, 'data delete --invite NOPE --yes')).code).toBe(1);
  }, T);

  it('stats shows counts and database size', async () => {
    const { app, url } = await start();
    await app.accounts!.store.createInvite({ code: 'A', maxUses: 5 });
    await register(app, 'alice', 'A');
    const s = await cli(url, 'stats');
    expect(s.code).toBe(0);
    expect(s.out).toContain('รหัสเชิญ 1 · ผู้เล่น 1 · คะแนน 0 รอบ · Log 0 รอบ');
    expect(s.out).toMatch(/ขนาดฐานข้อมูล \d+\.\d MB \(\d+\.\d % ของ 1 GB/);
  }, T);
});
