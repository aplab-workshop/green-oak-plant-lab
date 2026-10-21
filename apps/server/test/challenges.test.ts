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
  surprise?: boolean;
}

/** Lab ด่าน/Free Play ที่ Poll แล้วและเริ่มเล่น พร้อมตารางเหตุการณ์ที่กำหนดเอง */
async function labWith(level: LevelId | 'free', plan: PlanItem[]): Promise<TestLab> {
  const clock = new FakeClock();
  const mock = new MockPlcAdapter('manual', clock.now);
  const lab = new LabSession({ labId: 'lab01', adapter: mock, now: clock.now, level, sensorNoise: false, autoStart: true });
  const round = level === 'free' ? {} : levelRound(LEVELS.find((l) => l.id === level)!);
  const start = lab.sim.startTimeS;
  // reset ผ่าน LabSession เพื่อให้ Clock และสถานะเกม (autoStart → playing) เริ่มรอบใหม่ด้วย
  lab.reset(false, { ...round, challengePlan: plan.map((p, i) => ({ id: i + 1, kind: p.kind, startS: start + p.afterS, durationS: p.durationS, ...(p.surprise ? { surprise: true } : {}) })) });
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
    const t = await labWith('L4', [{ kind: 'heatWave', afterS: 8 * 3600, durationS: 6 * 3600 }]);
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
    const off = await labWith('L4', [{ kind: 'heatWave', afterS: 3600, durationS: 3600 }]);
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

  it('P43: L1 never pauses for leaks or low water; water < 65 % shows an alert that clears after refilling', async () => {
    const t = await labWith('L1', [{ kind: 'leak', afterS: 3600, durationS: 3 * 3600, surprise: true }]);
    expect(t.lab.snapshot().alerts).toEqual([]); // ถังว่างตอนเริ่ม ยังไม่แจ้ง
    t.lab.sim.setWaterLevelPct(70);
    await t.lab.handle({ type: 'setSpeed', speed: 720 });
    for (let ms = 0; ms < 30_000 && t.lab.snapshot().alerts.length === 0; ms += 500) await runReal(t, 500);
    let snap = t.lab.snapshot();
    expect(snap.paused).toBe(false);
    expect(snap.alerts.join()).toMatch(/น้ำเหลือ \d+% ต่ำกว่า 65%/);
    expect(snap.tank.waterLevelPct).toBeLessThan(65);
    expect(snap.challenges).toMatchObject([{ kind: 'leak', status: 'active' }]);
    const list = t.lab.events.list();
    expect(list.some((e) => e.kind === 'challenge.start')).toBe(true);
    expect(list.filter((e) => e.kind === 'game.autopause')).toHaveLength(0);
    expect(list.filter((e) => e.kind === 'tank.low_water')).toHaveLength(1);
    // เติมกลับถึง 65 % → แถบหาย; ตกลงใหม่ → แจ้งอีกครั้ง
    t.lab.sim.setWaterLevelPct(80);
    await runReal(t, 200);
    expect(t.lab.snapshot().alerts).toEqual([]);
    t.lab.sim.setWaterLevelPct(60);
    await runReal(t, 200);
    snap = t.lab.snapshot();
    expect(snap.paused).toBe(false);
    expect(snap.alerts.join()).toMatch(/น้ำเหลือ (59|60)% ต่ำกว่า 65%/);
    expect(t.lab.events.list().filter((e) => e.kind === 'tank.low_water')).toHaveLength(2);
  }, 60000);

  it('P44: L2 shows an EC alert from the start (EC 0.6) without pausing; feeding clears it', async () => {
    const t = await labWith('L2', []);
    await t.lab.handle({ type: 'setSpeed', speed: 720 });
    await runReal(t, 200);
    let snap = t.lab.snapshot();
    expect(snap.paused).toBe(false);
    expect(snap.alerts).toEqual([expect.stringMatching(/EC 0\.6\d ต่ำ/)]);
    expect(t.lab.events.list().filter((e) => e.kind === 'tank.ec_alert')).toHaveLength(1);
    t.lab.sim.setEc(1.2);
    await runReal(t, 200);
    expect(t.lab.snapshot().alerts).toEqual([]);
    t.lab.sim.setEc(2.0);
    await runReal(t, 200);
    snap = t.lab.snapshot();
    expect(snap.alerts.join()).toContain('เข้มเกิน');
    expect(snap.paused).toBe(false);
    expect(t.lab.events.list().filter((e) => e.kind === 'game.autopause')).toHaveLength(0);
  });

  it('P46: L3 heat wave (surprise) → hot and dry-air alerts without pausing; L2 (no fan/mist) never shows them', async () => {
    const t = await labWith('L3', [{ kind: 'heatWave', afterS: 2 * 3600, durationS: 6 * 3600, surprise: true }]);
    await t.lab.handle({ type: 'setManualLed', value: 100 });
    await t.lab.handle({ type: 'setSpeed', speed: 720 });
    for (let ms = 0; ms < 40_000 && !t.lab.snapshot().alerts.some((a) => a.includes('ร้อน')); ms += 500) await runReal(t, 500);
    const snap = t.lab.snapshot();
    expect(snap.paused).toBe(false);
    expect(snap.alerts.join()).toMatch(/🌡️ ร้อน \d+\.\d °C/);
    expect(t.lab.events.list().some((e) => e.kind === 'air.temp_alert')).toBe(true);
    expect(t.lab.events.list().filter((e) => e.kind === 'game.autopause')).toHaveLength(0);
    const l2 = await labWith('L2', [{ kind: 'heatWave', afterS: 600, durationS: 6 * 3600, surprise: true }]);
    await l2.lab.handle({ type: 'setManualLed', value: 100 });
    await l2.lab.handle({ type: 'setSpeed', speed: 720 });
    await runReal(l2, 15_000);
    expect(l2.lab.snapshot().sensors.airTempC).toBeGreaterThan(25);
    expect(l2.lab.snapshot().alerts.some((a) => a.includes('ร้อน') || a.includes('อากาศ'))).toBe(false);
  }, 60000);

  it('P42: L1 plays at 720x with a slower refill pump; other levels keep 144x and the default pump', async () => {
    const t = await labWith('L1', []);
    expect(t.lab.snapshot().level).toMatchObject({ playSpeed: 720, waterAlertPct: 65, timeLimitDays: 5 });
    expect(t.lab.sim.cfg.tank.refillFlowLpm).toBe(0.4);
    await t.lab.handle({ type: 'setSpeed', speed: 720 });
    expect(t.lab.snapshot().speed).toBe(720);
    const l4 = await labWith('L4', []);
    expect(l4.lab.snapshot().level).toMatchObject({ playSpeed: 144, waterAlertPct: null });
    expect(l4.lab.sim.cfg.tank.refillFlowLpm).toBe(2);
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
