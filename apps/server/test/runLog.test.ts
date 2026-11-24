import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { makeConfig } from '@gol/sim-core';
import type { AuthResponse, EventEntry, RunLogUpload } from '@gol/shared';
import { buildApp } from '../src/app';
import { runAdmin } from '../src/admin/cli';
import { buildRunLogCsv, csvCell, formatRealTime, kindLabel } from '../src/accounts/csv';
import type { RunLogRow } from '../src/accounts/AccountStore';
import { makeLab, runReal, testConfig } from './helpers';

/** W4 / SPEC § 4.41 / AC-72 — Log การเล่น (CSV) */

const T = 30_000;
const KEY = 'teacher-key-0123456789';
const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
});

async function start(): Promise<{ app: FastifyInstance; url: string; token: string; register: (name: string) => Promise<string> }> {
  const app = await buildApp(testConfig({ databaseUrl: 'memory://', authSecret: 's', adminKey: KEY }), { startLabs: false });
  apps.push(app);
  const url = await app.listen({ host: '127.0.0.1', port: 0 });
  await app.accounts!.store.createInvite({ code: 'ROOM1', maxUses: 10 });
  await app.accounts!.store.createInvite({ code: 'ROOM2', maxUses: 10 });
  const register = async (name: string, invite = name.startsWith('b') ? 'ROOM2' : 'ROOM1') =>
    (await app.inject({ method: 'POST', url: '/api/auth/register', payload: { username: name, password: 'password123', inviteCode: invite } })).json<AuthResponse>().token;
  return { app, url, token: await register('alice'), register };
}

const upload = (app: FastifyInstance, token: string | null, body: unknown) =>
  app.inject({ method: 'POST', url: '/api/runs/log', payload: body as Record<string, unknown>, headers: token ? { authorization: `Bearer ${token}` } : {} });

const toUpload = (runId: string, levelId: string, events: EventEntry[]): RunLogUpload => ({
  runId,
  levelId,
  events: events.map(({ id: _id, runId: _run, ...e }) => e),
});

const ev = (simTimeS: number, kind: string, message: string, value?: number | string) => ({ at: Date.UTC(2026, 10, 24, 2, 0, 0) + simTimeS, simTimeS, kind, severity: 'info' as const, message, ...(value !== undefined ? { value } : {}) });
/** แยกช่องของ CSV หนึ่งบรรทัด (รองรับ "…" และ "" ) */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') (cur += '"'), i++;
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') cells.push(cur), (cur = '');
    else cur += c;
  }
  return [...cells, cur];
}
const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('play log CSV format (W4)', () => {
  it('formats Thai time, kind labels, escaping and the Excel formula guard', () => {
    expect(formatRealTime(Date.UTC(2026, 10, 24, 2, 5, 7))).toBe('2026-11-24 09:05:07');
    expect(kindLabel('actuator.change')).toBe('ปรับอุปกรณ์');
    expect(kindLabel('challenge.start')).toBe('เหตุการณ์ของด่าน');
    expect(kindLabel('run.abandoned')).toBe('ออกกลางคัน');
    expect(kindLabel('something.new')).toBe('something.new');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=SUM(A1)', true)).toBe("'=SUM(A1)");
    expect(csvCell(40)).toBe('40');
    expect(csvCell(undefined)).toBe('');
  });

  it('numbers rounds per player + level and keeps event order', () => {
    const row = (id: number, username: string, levelId: string, minutes: number, events: ReturnType<typeof ev>[]): RunLogRow => ({
      id, playerId: 1, username, inviteCode: 'ROOM1', runId: UUID(id), levelId, events, createdAt: new Date(Date.UTC(2026, 10, 24, 3, minutes)),
    });
    const csv = buildRunLogCsv([
      row(3, 'alice', 'L1', 30, [ev(7 * 3600, 'game.start', 'เริ่ม')]),
      row(1, 'alice', 'L1', 10, [ev(6 * 3600, 'game.start', 'เริ่ม'), ev(86_400 + 6 * 3600 + 5 * 60, 'actuator.change', 'LED (D200): 40%', 40)]),
      row(2, 'alice', 'L2', 20, [ev(0, 'game.start', 'เริ่ม')]),
    ]);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines[0]).toBe('เวลาจริง,ผู้เล่น,รหัสเชิญ,ด่าน,รอบ,วันจำลอง,เวลาจำลอง,ชนิด,รายละเอียด,ค่า');
    expect(lines.slice(1).map((l) => l.split(',').slice(3, 7).join(','))).toEqual(['L1,1,0,06:00', 'L1,1,1,06:05', 'L1,2,0,07:00', 'L2,1,0,00:00']);
    expect(lines[2]!.endsWith('ปรับอุปกรณ์,LED (D200): 40%,40')).toBe(true);
  });
});

describe('play log upload + export (W4 / SPEC § 4.41)', () => {
  it('LabSession events carry values: switches, LED/fan %, speed, final score', async () => {
    const t = makeLab('lab01', 'manual', 1, { cfg: makeConfig({ plant: { harvestAtG: 3 }, game: { recordMinS: 10 } }) }, false);
    await t.lab.poll();
    await t.lab.handle({ type: 'startGame' });
    await t.lab.handle({ type: 'setManualBit', key: 'humidifier', value: true });
    await t.lab.handle({ type: 'setManualLed', value: 40 });
    await t.lab.handle({ type: 'setManualFan', value: 30 });
    await t.lab.poll();
    await t.lab.handle({ type: 'setSpeed', speed: 60 });
    await runReal(t, 2000);
    const events = t.lab.events.list();
    const values = events.filter((e) => e.value !== undefined).map((e) => [e.kind, e.value]);
    expect(values).toEqual(expect.arrayContaining([['actuator.change', 'ON'], ['actuator.change', 40], ['actuator.change', 30], ['sim.speed', 60]]));
    const won = events.find((e) => e.kind === 'game.won')!;
    expect(won.value).toBe(t.lab.snapshot().game.score);
  }, T);

  it('a finished round uploads, shows in the CSV in order with its score; duplicates are refused', async () => {
    const { app, url, token } = await start();
    const t = makeLab('lab01', 'manual', 1, { cfg: makeConfig({ plant: { harvestAtG: 3 }, game: { recordMinS: 10 } }) }, false);
    await t.lab.poll();
    await t.lab.handle({ type: 'startGame' });
    await t.lab.handle({ type: 'setManualLed', value: 55 });
    await t.lab.poll();
    await t.lab.handle({ type: 'setSpeed', speed: 60 });
    await runReal(t, 2000);
    const body = toUpload(UUID(1), 'L1', t.lab.events.list());

    expect((await upload(app, null, body)).statusCode).toBe(401);
    expect((await upload(app, 'forged.token', body)).statusCode).toBe(401);
    expect((await upload(app, token, { ...body, events: [] })).statusCode).toBe(400);
    expect((await upload(app, token, body)).statusCode).toBe(201);
    expect((await upload(app, token, body)).json()).toMatchObject({ code: 'duplicate_run' });

    const dir = await mkdtemp(join(tmpdir(), 'gol-csv-'));
    try {
      const out = join(dir, 'log.csv');
      const lines: string[] = [];
      expect(await runAdmin(['log', 'export', '--invite', 'room1', '--out', out], { url, key: KEY }, (l) => lines.push(l))).toBe(0);
      expect(lines[0]).toContain('1 รอบ');
      const raw = await readFile(out);
      expect([...raw.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      const rows = raw.toString('utf8').slice(1).trimEnd().split('\r\n').slice(1).map(parseCsvLine);
      expect(rows.map((r) => r[7])).toEqual(body.events.map((e) => kindLabel(e.kind)));
      expect(rows.every((r) => r[1] === 'alice' && r[2] === 'ROOM1' && r[3] === 'L1' && r[4] === '1')).toBe(true);
      const led = rows.findIndex((r) => r[8]!.includes('(D200)') && r[9] === '55');
      const end = rows.findIndex((r) => r[7] === 'จบรอบ (ชนะ)');
      expect(led).toBeGreaterThan(rows.findIndex((r) => r[7] === 'เริ่มเล่น'));
      expect(end).toBeGreaterThan(led);
      expect(rows[end]![9]).toBe(String(t.lab.snapshot().game.score));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, T);

  it('an abandoned log can be replaced by a later one for the same round; filters by player and level', async () => {
    const { app, url, token, register } = await start();
    const quit = { runId: UUID(5), levelId: 'L2', events: [ev(0, 'game.start', 'เริ่ม'), ev(60, 'run.abandoned', 'ออกกลางคัน')] };
    expect((await upload(app, token, quit)).statusCode).toBe(201);
    const full = { ...quit, events: [ev(0, 'game.start', 'เริ่ม'), ev(600, 'game.over', 'แพ้', 120)] };
    expect((await upload(app, token, full)).statusCode).toBe(201);
    expect((await upload(app, token, quit)).statusCode).toBe(409);
    const logs = await app.accounts!.store.listRunLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]!.events).toHaveLength(2);
    expect((logs[0]!.events[1] as { kind: string }).kind).toBe('game.over');

    const bobby = await register('bobby');
    await upload(app, bobby, { runId: UUID(6), levelId: 'L1', events: [ev(0, 'game.start', 'เริ่ม')] });
    await upload(app, token, { runId: UUID(7), levelId: 'L1', events: [ev(0, 'game.start', 'เริ่ม')] });

    const get = async (q: string) =>
      (await app.inject({ method: 'GET', url: `/api/admin/logs.csv${q}`, headers: { authorization: `Bearer ${KEY}` } })).headers['x-run-count'];
    expect(await get('')).toBe('3');
    expect(await get('?invite=room2')).toBe('1');
    expect(await get('?player=ALICE')).toBe('2');
    expect(await get('?player=alice&level=L2')).toBe('1');
    expect((await app.inject({ method: 'GET', url: '/api/admin/logs.csv' })).statusCode).toBe(401);
    void url;
  }, T);

  it('no accounts → no upload route', async () => {
    const app = await buildApp(testConfig(), { startLabs: false });
    apps.push(app);
    expect((await upload(app, 'x', {})).statusCode).toBe(404);
  });
});
