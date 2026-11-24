import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AccountStore, type ScoreInput } from '../src/accounts/AccountStore';
import { isPostgresUrl, openDatabase, type Database } from '../src/accounts/db';
import { MIGRATIONS, migrate } from '../src/accounts/migrations';

/** W1 / SPEC § 4.38 / AC-69 — ฐานข้อมูลบัญชีบน PGlite */

const T = 30_000; // PGlite เริ่มทำงาน ~1 s ต่อฐานข้อมูล
const open: Database[] = [];

async function fresh(url = 'memory://'): Promise<{ db: Database; store: AccountStore }> {
  const db = await openDatabase(url);
  open.push(db);
  await migrate(db);
  return { db, store: new AccountStore(db) };
}

afterEach(async () => {
  await Promise.all(open.splice(0).map((db) => db.close()));
});

const score = (playerId: number, runId: string, over: Partial<ScoreInput> = {}): ScoreInput => ({
  playerId,
  runId,
  levelId: 'L1',
  status: 'won',
  score: 950,
  stars: 3,
  biomassG: 8.91,
  simSeconds: 4 * 86400,
  realSeconds: 600,
  gameVersion: 'test',
  ranked: true,
  rejectReason: null,
  ...over,
});

describe('account database (W1 / SPEC § 4.38)', () => {
  it('chooses Postgres only for postgres:// URLs', () => {
    expect(isPostgresUrl('postgres://u:p@host/db')).toBe(true);
    expect(isPostgresUrl('postgresql://u:p@host/db?sslmode=require')).toBe(true);
    expect(isPostgresUrl('memory://')).toBe(false);
    expect(isPostgresUrl('./data/accounts')).toBe(false);
  });

  it('migration creates the 4 tables and is safe to run again', async () => {
    const { db } = await fresh();
    const { rows } = await db.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
    );
    expect(rows.map((r) => r.table_name)).toEqual(['invite_codes', 'players', 'run_logs', 'schema_migrations', 'scores']);
    expect(await migrate(db)).toEqual([]);
    const v = await db.query<{ version: number }>('SELECT version FROM schema_migrations');
    expect(v.rows.map((r) => r.version)).toEqual(MIGRATIONS.map((m) => m.version));
  }, T);

  it('invite codes: create, duplicate, get, list, deactivate', async () => {
    const { store } = await fresh();
    const a = await store.createInvite({ code: 'GO-AAAA-1111', maxUses: 100, note: 'ม.5/1' });
    expect(a).toMatchObject({ code: 'GO-AAAA-1111', maxUses: 100, usedCount: 0, active: true, note: 'ม.5/1' });
    expect(a!.createdAt).toBeInstanceOf(Date);
    expect(await store.createInvite({ code: 'GO-AAAA-1111', maxUses: 5 })).toBeNull();
    await store.createInvite({ code: 'GO-BBBB-2222', maxUses: 3 });
    expect((await store.listInvites()).map((i) => i.code)).toEqual(['GO-AAAA-1111', 'GO-BBBB-2222']);
    expect(await store.setInviteActive('GO-BBBB-2222', false)).toBe(true);
    expect((await store.getInvite('GO-BBBB-2222'))!.active).toBe(false);
    expect(await store.setInviteActive('NOPE', false)).toBe(false);
    expect(await store.getInvite('NOPE')).toBeNull();
  }, T);

  it('register uses up the invite: max 2 → third gets invite_full', async () => {
    const { store } = await fresh();
    await store.createInvite({ code: 'C2', maxUses: 2 });
    const reg = (username: string, inviteCode = 'C2') => store.registerPlayer({ username, passwordHash: 'h', inviteCode });
    expect(await reg('alice')).toMatchObject({ ok: true, player: { username: 'alice', inviteCode: 'C2', lastLoginAt: null } });
    expect((await reg('bob')).ok).toBe(true);
    expect(await reg('carol')).toEqual({ ok: false, reason: 'invite_full' });
    expect((await store.getInvite('C2'))!.usedCount).toBe(2);
    expect(await reg('dave', 'NOPE')).toEqual({ ok: false, reason: 'invite_not_found' });
    await store.createInvite({ code: 'OFF', maxUses: 10 });
    await store.setInviteActive('OFF', false);
    expect(await reg('erin', 'OFF')).toEqual({ ok: false, reason: 'invite_inactive' });
    expect((await store.getInvite('OFF'))!.usedCount).toBe(0);
  }, T);

  it('concurrent registrations never exceed max uses', async () => {
    const { store } = await fresh();
    await store.createInvite({ code: 'C3', maxUses: 3 });
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => store.registerPlayer({ username: `p${i}`, passwordHash: 'h', inviteCode: 'C3' })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect((await store.getInvite('C3'))!.usedCount).toBe(3);
    expect(await store.listPlayers('C3')).toHaveLength(3);
  }, T);

  it('a taken username is rejected without using up the invite', async () => {
    const { store } = await fresh();
    await store.createInvite({ code: 'C5', maxUses: 5 });
    await store.registerPlayer({ username: 'alice', passwordHash: 'h', inviteCode: 'C5' });
    expect(await store.registerPlayer({ username: 'alice', passwordHash: 'h2', inviteCode: 'C5' })).toEqual({
      ok: false,
      reason: 'username_taken',
    });
    expect((await store.getInvite('C5'))!.usedCount).toBe(1);
  }, T);

  it('players: login lookup, password change, last login, list by invite', async () => {
    const { store } = await fresh();
    await store.createInvite({ code: 'A', maxUses: 5 });
    await store.createInvite({ code: 'B', maxUses: 5 });
    const r = await store.registerPlayer({ username: 'alice', passwordHash: 'hash1', inviteCode: 'A' });
    await store.registerPlayer({ username: 'bob', passwordHash: 'x', inviteCode: 'B' });
    if (!r.ok) throw new Error('register failed');
    const id = r.player.id;
    expect((await store.getPlayerForLogin('alice'))!.passwordHash).toBe('hash1');
    expect(await store.getPlayerForLogin('nobody')).toBeNull();
    expect(await store.getPlayer(id)).not.toHaveProperty('passwordHash');
    expect(await store.setPasswordHash(id, 'hash2')).toBe(true);
    expect((await store.getPlayerForLogin('alice'))!.passwordHash).toBe('hash2');
    await store.touchLogin(id);
    expect((await store.getPlayer(id))!.lastLoginAt).toBeInstanceOf(Date);
    expect((await store.listPlayers()).map((p) => p.username)).toEqual(['alice', 'bob']);
    expect((await store.listPlayers('B')).map((p) => p.username)).toEqual(['bob']);
  }, T);

  it('scores + run logs: save, reject duplicate run, filter by player/invite/level', async () => {
    const { store } = await fresh();
    await store.createInvite({ code: 'A', maxUses: 5 });
    await store.createInvite({ code: 'B', maxUses: 5 });
    const a = await store.registerPlayer({ username: 'alice', passwordHash: 'h', inviteCode: 'A' });
    const b = await store.registerPlayer({ username: 'bob', passwordHash: 'h', inviteCode: 'B' });
    if (!a.ok || !b.ok) throw new Error('register failed');
    const pa = a.player.id;
    const pb = b.player.id;

    expect(await store.insertScore(score(pa, 'run-1'))).toBeTypeOf('number');
    expect(await store.insertScore(score(pa, 'run-1', { score: 1500 }))).toBeNull();
    await store.insertScore(score(pa, 'run-2', { levelId: 'L2', status: 'lost', stars: 0, score: 120, ranked: false, rejectReason: 'too_fast' }));
    await store.insertScore(score(pb, 'run-1'));

    const all = await store.listScores();
    expect(all).toHaveLength(3);
    expect(all[0]).toMatchObject({ username: 'alice', inviteCode: 'A', runId: 'run-1', score: 950, biomassG: 8.91, ranked: true, rejectReason: null });
    expect((await store.listScores({ inviteCode: 'B' })).map((s) => s.username)).toEqual(['bob']);
    expect(await store.listScores({ playerId: pa, levelId: 'L2' })).toMatchObject([{ status: 'lost', ranked: false, rejectReason: 'too_fast' }]);

    const events = [
      { t: 0, kind: 'start', text: 'เริ่มรอบ' },
      { t: 3600, kind: 'actuator', text: 'LED', value: 40 },
    ];
    expect(await store.insertRunLog({ playerId: pa, runId: 'run-1', levelId: 'L1', events })).toBeTypeOf('number');
    expect(await store.insertRunLog({ playerId: pa, runId: 'run-1', levelId: 'L1', events: [] })).toBeNull();
    await store.insertRunLog({ playerId: pb, runId: 'run-1', levelId: 'L1', events: [] });
    const logs = await store.listRunLogs({ inviteCode: 'A' });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ username: 'alice', runId: 'run-1', events });
  }, T);

  it('deleting a player removes their scores and logs', async () => {
    const { store } = await fresh();
    await store.createInvite({ code: 'A', maxUses: 5 });
    const a = await store.registerPlayer({ username: 'alice', passwordHash: 'h', inviteCode: 'A' });
    if (!a.ok) throw new Error('register failed');
    await store.insertScore(score(a.player.id, 'run-1'));
    await store.insertRunLog({ playerId: a.player.id, runId: 'run-1', levelId: 'L1', events: [] });
    expect(await store.deletePlayer(a.player.id)).toBe(true);
    expect(await store.deletePlayer(a.player.id)).toBe(false);
    expect(await store.listScores()).toEqual([]);
    expect(await store.listRunLogs()).toEqual([]);
  }, T);

  it('a folder database keeps its data after close and reopen', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gol-accounts-'));
    try {
      const first = await fresh(dir);
      await first.store.createInvite({ code: 'KEEP', maxUses: 4 });
      await first.store.registerPlayer({ username: 'alice', passwordHash: 'h', inviteCode: 'KEEP' });
      await first.db.close();
      open.splice(open.indexOf(first.db), 1);

      const again = await fresh(dir);
      expect((await again.store.getInvite('KEEP'))!.usedCount).toBe(1);
      expect((await again.store.listPlayers()).map((p) => p.username)).toEqual(['alice']);
      await again.db.close();
      open.splice(open.indexOf(again.db), 1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, T);
});
