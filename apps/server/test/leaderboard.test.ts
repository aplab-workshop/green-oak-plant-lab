import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AuthResponse, Leaderboard, MyLevelScore, RunSubmitResponse } from '@gol/shared';
import { buildApp } from '../src/app';
import type { ScoreInput } from '../src/accounts/AccountStore';
import { testConfig } from './helpers';

/** W6 / SPEC § 4.43 / AC-74 — ตารางอันดับ + คะแนนของฉัน */

const T = 60_000;
const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
});

async function setup() {
  const app = await buildApp(testConfig({ databaseUrl: 'memory://', authSecret: 's' }), { startLabs: false });
  apps.push(app);
  const { store } = app.accounts!;
  await store.createInvite({ code: 'ROOM1', maxUses: 100 });
  await store.createInvite({ code: 'ROOM2', maxUses: 100 });
  const tokens: Record<string, string> = {};
  const ids: Record<string, number> = {};
  for (const [name, code] of [['alice', 'ROOM1'], ['bobby', 'ROOM1'], ['carol', 'ROOM2']] as const) {
    const res = (await app.inject({ method: 'POST', url: '/api/auth/register', payload: { username: name, password: 'password123', inviteCode: code }, remoteAddress: `10.3.0.${name.length}${name.charCodeAt(0)}` })).json<AuthResponse>();
    tokens[name] = res.token;
    ids[name] = res.player.id;
  }
  let run = 0;
  const score = (name: string, over: Partial<ScoreInput>) =>
    store.insertScore({ playerId: ids[name]!, runId: `run-${++run}`, levelId: 'L1', status: 'won', score: 1000, stars: 3, biomassG: 60, simSeconds: 4 * 86400, realSeconds: 600, gameVersion: 't', ranked: true, rejectReason: null, ...over });
  const get = <B>(name: string, url: string) => app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${tokens[name]}` } }).then((r) => ({ status: r.statusCode, body: r.json<B>(), raw: r.body }));
  return { app, store, tokens, ids, score, get };
}

describe('leaderboard (W6 / SPEC § 4.43)', () => {
  it('one best ranked win per player, sorted by score then real time; no invite codes leak', async () => {
    const { score, get } = await setup();
    await score('alice', { score: 1200, realSeconds: 600 });
    await score('alice', { score: 1300, realSeconds: 700 });
    await score('alice', { status: 'lost', score: 0, stars: 0 });
    await score('alice', { score: 1500, ranked: false, rejectReason: 'too_fast' });
    await score('bobby', { score: 1300, realSeconds: 500, stars: 2 });
    await score('carol', { score: 900 });
    await score('carol', { score: 1400, levelId: 'L2' });

    const all = await get<Leaderboard>('alice', '/api/leaderboard?level=L1');
    expect(all.status).toBe(200);
    expect(all.body.rows.map((r) => [r.rank, r.username, r.score, r.me])).toEqual([
      [1, 'bobby', 1300, false],
      [2, 'alice', 1300, true],
      [3, 'carol', 900, false],
    ]);
    expect(all.body.me).toMatchObject({ rank: 2, username: 'alice', realSeconds: 700 });
    expect(all.raw).not.toMatch(/ROOM|invite/i);

    const group = await get<Leaderboard>('carol', '/api/leaderboard?level=L1&scope=group');
    expect(group.body.rows.map((r) => r.username)).toEqual(['carol']);
    expect(group.body.me).toMatchObject({ rank: 1 });
    expect((await get<Leaderboard>('bobby', '/api/leaderboard?level=L1&scope=group')).body.rows.map((r) => r.username)).toEqual(['bobby', 'alice']);
    expect((await get<Leaderboard>('alice', '/api/leaderboard?level=L4')).body).toMatchObject({ rows: [], me: null });
  }, T);

  it('shows the top 50 plus my own row when I am further down', async () => {
    const { app, store, score, get } = await setup();
    for (let i = 0; i < 52; i++) {
      const r = await store.registerPlayer({ username: `p${String(i).padStart(2, '0')}x`, passwordHash: 'h', inviteCode: 'ROOM2' });
      if (!r.ok) throw new Error('register');
      await store.insertScore({ playerId: r.player.id, runId: 'r', levelId: 'L1', status: 'won', score: 1100 + i, stars: 3, biomassG: 60, simSeconds: 1, realSeconds: 600, gameVersion: 't', ranked: true, rejectReason: null });
    }
    await score('alice', { score: 1000 });
    const board = (await get<Leaderboard>('alice', '/api/leaderboard?level=L1')).body;
    expect(board.rows).toHaveLength(50);
    expect(board.rows[0]).toMatchObject({ rank: 1, score: 1151 });
    expect(board.rows.some((r) => r.me)).toBe(false);
    expect(board.me).toMatchObject({ rank: 53, username: 'alice', me: true });
    void app;
  }, T);

  it('my scores per level follow the account (new login sees the same), and need a token', async () => {
    const { app, score, get } = await setup();
    await score('alice', { score: 1200, stars: 2 });
    await score('alice', { score: 1300, stars: 3 });
    await score('alice', { status: 'lost', score: 0, stars: 0 });
    await score('alice', { levelId: 'L2', status: 'lost', score: 0, stars: 0 });
    const mine = await get<MyLevelScore[]>('alice', '/api/me/scores');
    expect(mine.body).toEqual([
      { levelId: 'L1', bestScore: 1300, bestStars: 3, wins: 2, rounds: 3 },
      { levelId: 'L2', bestScore: null, bestStars: null, wins: 0, rounds: 1 },
    ]);
    const again = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'alice', password: 'password123' } })).json<AuthResponse>();
    const other = await app.inject({ method: 'GET', url: '/api/me/scores', headers: { authorization: `Bearer ${again.token}` } });
    expect(other.json()).toEqual(mine.body);

    expect((await app.inject({ method: 'GET', url: '/api/me/scores' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/leaderboard?level=L1' })).statusCode).toBe(401);
    expect((await get('alice', '/api/leaderboard')).status).toBe(400);
  }, T);

  it('a ranked winning submission answers with the current rank', async () => {
    const { score, tokens, app } = await setup();
    await score('bobby', { score: 1400 });
    const t0 = Date.now() - 600_000;
    const start = 14 * 86400 + 6 * 3600;
    const res = await app.inject({
      method: 'POST',
      url: '/api/runs/log',
      headers: { authorization: `Bearer ${tokens.alice}` },
      payload: {
        runId: '00000000-0000-4000-8000-000000000001',
        levelId: 'L1',
        events: [
          { at: t0, simTimeS: start, kind: 'game.start', severity: 'info', message: 'เริ่ม' },
          { at: t0 + 500_000, simTimeS: start + 4 * 86400, kind: 'game.won', severity: 'info', message: 'ชนะ', value: 1310 },
        ],
        result: { status: 'won', score: 1310, stars: 3, yieldG: 55, elapsedS: 4 * 86400, testRun: false, gameVersion: 't' },
      },
    });
    expect(res.json<RunSubmitResponse>()).toMatchObject({ score: { ranked: true, rank: 2 } });
  }, T);
});
