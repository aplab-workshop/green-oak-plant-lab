import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AuthResponse, RunLogEvent, RunResult } from '@gol/shared';
import { buildApp } from '../src/app';
import { runAdmin } from '../src/admin/cli';
import { SCORE_MAX, checkRun } from '../src/accounts/plausibility';
import { testConfig } from './helpers';

/** W5 / SPEC § 4.42 / AC-73 — ส่งคะแนน + ตรวจความสมเหตุสมผล */

const T = 30_000;
const KEY = 'teacher-key-0123456789';
const DAY = 86_400;
const T0 = Date.UTC(2026, 10, 24, 2, 0, 0);
const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
});

/** รอบ L1 ที่เป็นไปได้: ชนะวันที่ 4 ใช้เวลาจริง 10 นาที (720x ≈ 8 นาที) */
function wonRun(over: Partial<RunResult> = {}, realS = 600, elapsedS = 4 * DAY): { result: RunResult; events: RunLogEvent[] } {
  const result: RunResult = { status: 'won', score: 1310, stars: 3, yieldG: 6 * 9.1, elapsedS, testRun: false, gameVersion: 'test', ...over };
  const start = 14 * DAY + 6 * 3600;
  return {
    result,
    events: [
      { at: T0, simTimeS: start, kind: 'game.start', severity: 'info', message: 'เริ่มปลูก' },
      { at: T0 + 5000, simTimeS: start + 3600, kind: 'actuator.change', severity: 'info', message: 'LED 40%', value: 40 },
      { at: T0 + realS * 1000, simTimeS: start + elapsedS, kind: result.status === 'won' ? 'game.won' : 'game.over', severity: 'info', message: 'จบ', value: result.score },
    ],
  };
}

describe('plausibility checks (W5)', () => {
  const now = T0 + 3600_000;

  it('a normal L1 win passes and real time comes from the log', () => {
    const { result, events } = wonRun();
    expect(checkRun('L1', result, events, now)).toEqual({ reasons: [], realSeconds: 600 });
    expect(SCORE_MAX).toBe(1500);
  });

  it('a normal loss (score 0, no stars) passes', () => {
    const { result, events } = wonRun({ status: 'lost', score: 0, stars: 0, yieldG: 0 }, 900, 5 * DAY);
    expect(checkRun('L1', result, events, now).reasons).toEqual([]);
  });

  const cases: [string, Parameters<typeof wonRun>, string, string][] = [
    ['score over 1500', [{ score: 99_999 }], 'L1', 'score_range'],
    ['fractional score', [{ score: 1200.5 }], 'L1', 'score_range'],
    ['lost with points', [{ status: 'lost', score: 500, stars: 0, yieldG: 0 }, 900, 5 * DAY], 'L1', 'result_mismatch'],
    ['won with 0 stars', [{ stars: 0 }], 'L1', 'result_mismatch'],
    ['won below target', [{ yieldG: 5 }], 'L1', 'yield_below_target'],
    ['longer than the level', [{}, 900, 9 * DAY], 'L1', 'time_over_limit'],
    ['faster than 1440x', [{}, 60], 'L1', 'too_fast'],
    ['free play', [{}], 'free', 'not_level'],
    ['unknown level', [{}], 'L9', 'not_level'],
    ['test run', [{ testRun: true }], 'L1', 'test_run'],
  ];
  it.each(cases)('%s → not ranked', (_name, args, level, reason) => {
    const { result, events } = wonRun(...args);
    expect(checkRun(level, result, events, now).reasons).toContain(reason);
  });

  it('incomplete or inconsistent logs are not ranked', () => {
    const { result, events } = wonRun();
    expect(checkRun('L1', result, events.slice(1), now).reasons).toContain('log_incomplete');
    expect(checkRun('L1', result, events.slice(0, 2), now).reasons).toContain('log_incomplete');
    expect(checkRun('L1', { ...result, score: 1400 }, events, now).reasons).toContain('log_incomplete');
    // บอกเวลาจำลองน้อย ๆ เพื่อเลี่ยง too_fast แต่ Log ไม่ตรง
    expect(checkRun('L1', { ...result, elapsedS: 60 }, events, now).reasons).toContain('log_incomplete');
    expect(checkRun('L1', result, events, T0).reasons).toContain('future_time');
  });
});

describe('score submission API (W5 / SPEC § 4.42)', () => {
  async function start() {
    const app = await buildApp(testConfig({ databaseUrl: 'memory://', authSecret: 's', adminKey: KEY }), { startLabs: false, now: () => T0 + 3600_000 });
    apps.push(app);
    const url = await app.listen({ host: '127.0.0.1', port: 0 });
    await app.accounts!.store.createInvite({ code: 'ROOM1', maxUses: 10 });
    const token = (await app.inject({ method: 'POST', url: '/api/auth/register', payload: { username: 'alice', password: 'password123', inviteCode: 'ROOM1' } })).json<AuthResponse>().token;
    const send = (body: unknown) =>
      app.inject({ method: 'POST', url: '/api/runs/log', payload: body as Record<string, unknown>, headers: { authorization: `Bearer ${token}` } });
    return { app, url, send };
  }
  const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

  it('saves ranked and unranked scores with reasons; a round can only be scored once', async () => {
    const { app, url, send } = await start();
    const ok = wonRun();
    const res = await send({ runId: UUID(1), levelId: 'L1', ...ok });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ score: { ranked: true, reasons: [] } });
    expect((await send({ runId: UUID(1), levelId: 'L1', ...ok })).statusCode).toBe(409);

    const fake = wonRun({ score: 99_999 }, 30);
    expect((await send({ runId: UUID(2), levelId: 'L1', ...fake })).json()).toMatchObject({ score: { ranked: false, reasons: expect.arrayContaining(['score_range', 'too_fast']) } });

    const scores = await app.accounts!.store.listScores();
    expect(scores.map((s) => [s.ranked, s.score, s.realSeconds])).toEqual([[true, 1310, 600], [false, 99_999, 30]]);
    expect(scores[1]!.rejectReason).toContain('too_fast');
    expect(await app.accounts!.store.listRunLogs()).toHaveLength(2);

    const lines: string[] = [];
    expect(await runAdmin(['score', 'list', '--unranked'], { url, key: KEY }, (l) => lines.push(l))).toBe(0);
    const out = lines.join('\n');
    expect(out).toContain('ไม่นับ: คะแนนเกินช่วง 0–1500');
    expect(out).toContain('เร็วกว่าความเร็วสูงสุด 1440x');
    expect(out).toContain('รวม 1 รอบ (ไม่นับอันดับ 1)');
    expect(out).not.toMatch(/1310/);
  }, T);

  it('quit first (log only), then the finished round replaces it and gets a score', async () => {
    const { app, send } = await start();
    const { result, events } = wonRun();
    const quit = [...events.slice(0, 2), { at: T0 + 9000, simTimeS: events[1]!.simTimeS, kind: 'run.abandoned', severity: 'warning' as const, message: 'ออกกลางคัน' }];
    expect((await send({ runId: UUID(3), levelId: 'L1', events: quit })).json()).toMatchObject({ score: null });
    expect(await app.accounts!.store.listScores()).toEqual([]);
    expect((await send({ runId: UUID(3), levelId: 'L1', events, result })).json()).toMatchObject({ score: { ranked: true } });
    expect(await app.accounts!.store.listScores()).toHaveLength(1);
    expect((await app.accounts!.store.listRunLogs())[0]!.events).toHaveLength(3);
  }, T);

  it('rejects an invalid result shape', async () => {
    const { send } = await start();
    const { events } = wonRun();
    expect((await send({ runId: UUID(4), levelId: 'L1', events, result: { status: 'won', score: 'lots' } })).statusCode).toBe(400);
  }, T);
});
