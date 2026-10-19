import { describe, expect, it } from 'vitest';
import type { ChallengeKind, LevelId } from '@gol/shared';
import { LEVELS, levelRound } from '@gol/sim-core';
import { LabCommandError, LabSession } from '../src/lab/LabSession';
import { MockPlcAdapter } from '../src/plc/MockPlcAdapter';
import { FakeClock, runReal, type TestLab } from './helpers';

interface PlanItem {
  kind: ChallengeKind;
  /** เริ่มหลังเริ่มรอบกี่วินาทีจำลอง */
  afterS: number;
  durationS: number | null;
}

/** Lab ด่าน/Free Play ที่ Poll แล้วและเริ่มเล่น พร้อมตารางเหตุการณ์ที่กำหนดเอง */
async function labWith(level: LevelId | 'free', plan: PlanItem[]): Promise<TestLab> {
  const clock = new FakeClock();
  const mock = new MockPlcAdapter('manual', clock.now);
  const lab = new LabSession({ labId: 'lab01', adapter: mock, now: clock.now, level, sensorNoise: false, autoStart: true });
  const round = level === 'free' ? {} : levelRound(LEVELS.find((l) => l.id === level)!);
  const start = lab.sim.startTimeS;
  // reset ผ่าน LabSession เพื่อให้ Clock และสถานะเกม (autoStart → playing) เริ่มรอบใหม่ด้วย
  lab.reset(false, { ...round, challengePlan: plan.map((p, i) => ({ id: i + 1, kind: p.kind, startS: start + p.afterS, durationS: p.durationS })) });
  await lab.poll();
  return { lab, mock, clock };
}

/** เดินจนกว่า Clock จะหยุด (หรือครบเวลาจริง) */
async function runUntilPaused(t: TestLab, maxRealMs: number): Promise<void> {
  for (let ms = 0; ms < maxRealMs && !t.lab.clock.paused; ms += 500) await runReal(t, 500);
}

const rejected409 = async (p: Promise<unknown>) => {
  await expect(p).rejects.toBeInstanceOf(LabCommandError);
  await expect(p).rejects.toMatchObject({ statusCode: 409 });
};

describe('Events & auto-pause in LabSession — P23 / AC-39', () => {
  it('auto-pauses on the 6 h warning and again when the event starts', async () => {
    const t = await labWith('L3', [{ kind: 'heatWave', afterS: 8 * 3600, durationS: 6 * 3600 }]);
    await t.lab.handle({ type: 'setSpeed', speed: 360 });
    expect(t.lab.snapshot().challenges).toEqual([]);

    await runUntilPaused(t, 60_000);
    let snap = t.lab.snapshot();
    expect(snap.paused).toBe(true);
    expect(snap.autoPause.reason).toContain('คลื่นความร้อน');
    expect(snap.challenges).toMatchObject([{ kind: 'heatWave', status: 'warned' }]);
    const warnedAt = t.lab.sim.simTimeS - t.lab.sim.startTimeS;
    expect(warnedAt).toBeGreaterThanOrEqual(2 * 3600);
    expect(warnedAt).toBeLessThan(2 * 3600 + 60); // หยุดหลังจบ Tick ที่ตรวจพบ

    await t.lab.handle({ type: 'resume' });
    expect(t.lab.snapshot().autoPause.reason).toBeNull();
    await runUntilPaused(t, 120_000);
    snap = t.lab.snapshot();
    expect(snap.challenges[0]!.status).toBe('active');
    expect(snap.autoPause.reason).toContain('มาแล้ว');
    expect(t.lab.events.list().filter((e) => e.kind === 'game.autopause')).toHaveLength(2);
  }, 30000);

  it('does not pause when disabled, nor in Free Play', async () => {
    const off = await labWith('L3', [{ kind: 'heatWave', afterS: 3600, durationS: 3600 }]);
    await off.lab.handle({ type: 'setAutoPause', enabled: false });
    await off.lab.handle({ type: 'setSpeed', speed: 360 });
    await runReal(off, 40_000); // 4 ชม.
    expect(off.lab.clock.paused).toBe(false);
    expect(off.lab.snapshot().autoPause).toEqual({ enabled: false, reason: null });

    const free = await labWith('free', [{ kind: 'heatWave', afterS: 3600, durationS: 3600 }]);
    await free.lab.handle({ type: 'setSpeed', speed: 360 });
    await runReal(free, 40_000);
    expect(free.lab.clock.paused).toBe(false);
    expect(free.lab.snapshot().challenges[0]!.status).toBe('done'); // เหตุการณ์ยังทำงาน แค่ไม่หยุดเกม
  }, 30000);

  it('auto-pauses the first time a watched value turns red, once per value per round', async () => {
    const t = await labWith('L4', []);
    t.lab.sim.setWaterLevelPct(50); // < 55 % = แดง
    await runReal(t, 200);
    expect(t.lab.clock.paused).toBe(true);
    expect(t.lab.snapshot().autoPause.reason).toContain('Water Level');
    await t.lab.handle({ type: 'resume' });
    await runReal(t, 2000);
    expect(t.lab.clock.paused).toBe(false);
    // Reset เริ่มนับใหม่
    await t.lab.handle({ type: 'reset' });
    expect(t.lab.snapshot().autoPause.reason).toBeNull();
  });

  it('repairLeak stops an active leak; otherwise 409', async () => {
    const t = await labWith('L4', [{ kind: 'leak', afterS: 600, durationS: null }]);
    await t.lab.handle({ type: 'setAutoPause', enabled: false });
    await rejected409(t.lab.handle({ type: 'repairLeak' }));
    await t.lab.handle({ type: 'setSpeed', speed: 60 });
    await runReal(t, 20_000); // 20 นาที → รั่วแล้ว
    expect(t.lab.snapshot().challenges[0]!.status).toBe('active');
    await t.lab.handle({ type: 'repairLeak' });
    expect(t.lab.snapshot().challenges[0]).toMatchObject({ status: 'done', repaired: true });
    expect(t.lab.events.list().some((e) => e.message.includes('ซ่อมเรียบร้อย'))).toBe(true);
    await rejected409(t.lab.handle({ type: 'repairLeak' }));
  });

  it('power outage shows every actuator OFF and freezes dose countdown until power returns', async () => {
    const t = await labWith('free', [{ kind: 'powerOutage', afterS: 60, durationS: 7200 }]);
    await t.lab.handle({ type: 'pause' });
    await t.lab.handle({ type: 'dose', device: 'refill' }); // 120 s
    await t.lab.handle({ type: 'setSpeed', speed: 60 });
    await t.lab.handle({ type: 'resume' });
    await runReal(t, 10_000); // 600 s จำลอง
    let snap = t.lab.snapshot();
    expect(snap.commands).toMatchObject({ refillPump: false, airPump: false, ledPct: 0 });
    expect(snap.doses[0]!.remainingS).toBeCloseTo(60, 6); // นับไป 60 s ก่อนไฟดับ แล้วหยุด
    await runReal(t, 120_000); // ไฟกลับมา
    snap = t.lab.snapshot();
    expect(snap.challenges[0]!.status).toBe('done');
    expect(snap.doses).toEqual([]);
    expect(snap.commands.airPump).toBe(true);
  }, 30000);
});
