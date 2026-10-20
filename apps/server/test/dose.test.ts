import { describe, expect, it } from 'vitest';
import type { DoseDevice } from '@gol/shared';
import { envEc } from '@gol/sim-core';
import { LabCommandError, LabSession } from '../src/lab/LabSession';
import { MockPlcAdapter } from '../src/plc/MockPlcAdapter';
import { FakeClock, makeLab, runReal, type TestLab } from './helpers';

/** เวลาจำลองที่เดินหลังสั่งโดส — ยาวกว่าทุกโดส */
const RUN_S = 1800;

/** สั่งโดสขณะ Pause แล้วเดิน RUN_S วินาทีจำลองที่ Speed ที่กำหนด */
async function runDose(speed: 60 | 3600, device: DoseDevice | null, tickMs = 100): Promise<TestLab> {
  const t = makeLab('lab01', 'manual');
  await t.lab.handle({ type: 'setSpeed', speed });
  await t.lab.handle({ type: 'pause' });
  await t.lab.poll();
  if (device) await t.lab.handle({ type: 'dose', device });
  await t.lab.handle({ type: 'resume' });
  await runReal(t, (RUN_S / speed) * 1000, tickMs);
  return t;
}

/** Lab โหมด manual ที่ Poll แล้ว (Lab เริ่มใน Fail-safe จนอ่านคำสั่งจาก PLC ได้ครั้งแรก) */
async function manualLab(): Promise<TestLab> {
  const t = makeLab('lab01', 'manual');
  await t.lab.poll();
  return t;
}

const expectRejected = async (p: Promise<unknown>) => {
  await expect(p).rejects.toBeInstanceOf(LabCommandError);
  await expect(p).rejects.toMatchObject({ statusCode: 409 });
};

describe('Dose commands — P22 / AC-38', () => {
  it.each(['refill', 'nutrient', 'phDown'] as const)('%s dose gives identical state at 60x, 3600x and different tick sizes', async (device) => {
    const slow = await runDose(60, device);
    const fast = await runDose(3600, device);
    const split = await runDose(3600, device, 50);
    expect(fast.lab.sim.simTimeS).toBe(slow.lab.sim.simTimeS);
    expect(fast.lab.sim.snapshot()).toEqual(slow.lab.sim.snapshot());
    expect(split.lab.sim.snapshot()).toEqual(slow.lab.sim.snapshot());
  }, 30000);

  it('effects match the config: refill +10 %, nutrient EC +≈0.15, pH Down −≈0.2', async () => {
    const control = (await runDose(3600, null)).lab.sim.env;
    const refill = (await runDose(3600, 'refill')).lab.sim.env;
    const nutrient = (await runDose(3600, 'nutrient')).lab.sim.env;
    const ph = (await runDose(3600, 'phDown')).lab.sim.env;
    expect(refill.waterVolumeL - control.waterVolumeL).toBeCloseTo(4, 2); // 10 % ของ 40 L
    expect(envEc(nutrient) - envEc(control)).toBeCloseTo(0.15, 1);
    expect(control.ph - ph.ph).toBeCloseTo(0.2, 2);
  }, 30000);

  it('shows the dose in the snapshot, logs it and turns the actuator off when done', async () => {
    const t = await manualLab();
    await t.lab.handle({ type: 'setSpeed', speed: 60 });
    await t.lab.handle({ type: 'dose', device: 'refill' });
    let snap = t.lab.snapshot();
    expect(snap.commands.refillPump).toBe(true);
    expect(snap.doses).toEqual([{ device: 'refill', remainingS: 120, totalS: 120 }]);
    await runReal(t, 1000); // 60 s จำลอง
    expect(t.lab.snapshot().doses[0]!.remainingS).toBeCloseTo(60, 6);
    await runReal(t, 1100);
    snap = t.lab.snapshot();
    expect(snap.doses).toEqual([]);
    expect(snap.commands.refillPump).toBe(false);
    const kinds = t.lab.events.list().map((e) => e.kind);
    expect(kinds).toContain('dose.start');
    expect(kinds).toContain('dose.done');
    // ไม่เขียน Mock PLC memory: Bit ของนักเรียนยังเป็น OFF
    expect(t.mock.memory.getM(102)).toBe(false);
  });

  it('queues repeated presses up to the limit, then rejects', async () => {
    const t = await manualLab();
    await t.lab.handle({ type: 'pause' });
    for (let i = 0; i < 5; i++) await t.lab.handle({ type: 'dose', device: 'refill' });
    expect(t.lab.snapshot().doses[0]).toMatchObject({ remainingS: 600, totalS: 600 });
    await expectRejected(t.lab.handle({ type: 'dose', device: 'refill' }));
  });

  it('a manual command on the same bit cancels the dose', async () => {
    const t = await manualLab();
    await t.lab.handle({ type: 'dose', device: 'nutrient' });
    await t.lab.handle({ type: 'setManualBit', key: 'nutrientB', value: false });
    const snap = t.lab.snapshot();
    expect(snap.doses).toEqual([]);
    expect(snap.commands.nutrientA).toBe(false);
  });

  it('is rejected in Auto mode and while in fail-safe; fail-safe clears pending doses', async () => {
    await expectRejected(makeLab('lab01', 'auto').lab.handle({ type: 'dose', device: 'refill' }));

    const t = await manualLab();
    await t.lab.handle({ type: 'pause' });
    await t.lab.handle({ type: 'dose', device: 'phDown' });
    t.mock.setMode('offline'); // สายหลุดโดยไม่ผ่านคำสั่ง setPlcMode
    await runReal(t, 4000);
    expect(t.lab.isFailsafe).toBe(true);
    expect(t.lab.snapshot().doses).toEqual([]);
    expect(t.lab.events.list().some((e) => e.kind === 'dose.cancel')).toBe(true);
  });

  it('is rejected for devices that are locked in the current level', async () => {
    const clock = new FakeClock();
    const lab = new LabSession({ labId: 'lab01', adapter: new MockPlcAdapter('manual', clock.now), now: clock.now, level: 'L1', sensorNoise: false });
    await lab.poll();
    await expectRejected(lab.handle({ type: 'dose', device: 'nutrient' }));
    await expectRejected(lab.handle({ type: 'dose', device: 'phDown' }));
    await lab.handle({ type: 'dose', device: 'refill' });
    expect(lab.snapshot().doses).toHaveLength(1);
  });

  it('farm helper doses pH Down when pH > 6.6 in levels where M106 is locked', async () => {
    const clock = new FakeClock();
    const lab = new LabSession({ labId: 'lab01', adapter: new MockPlcAdapter('manual', clock.now), now: clock.now, level: 'L2', sensorNoise: false });
    lab.sim.setPh(7.0);
    await lab.poll();
    expect(lab.snapshot().doses).toEqual([{ device: 'phDown', remainingS: 120, totalS: 120 }]);
    expect(lab.events.list().some((e) => e.message.startsWith('ผู้ช่วยฟาร์ม'))).toBe(true);
    // L4 ผู้เล่นคุม pH Down เอง ผู้ช่วยไม่ยุ่ง
    const own = new LabSession({ labId: 'lab02', adapter: new MockPlcAdapter('manual', clock.now), now: clock.now, level: 'L4', sensorNoise: false });
    own.sim.setPh(7.0);
    await own.poll();
    expect(own.snapshot().doses).toEqual([]);
  });

  it('P37: L1 (locked devices OFF) gets no helper nutrient doses even after heavy refilling', async () => {
    const clock = new FakeClock();
    const t: TestLab = {
      clock,
      mock: new MockPlcAdapter('manual', clock.now),
      lab: undefined as unknown as LabSession,
    };
    t.lab = new LabSession({ labId: 'lab01', adapter: t.mock, now: clock.now, level: 'L1', sensorNoise: false, autoStart: true });
    await t.lab.poll();
    await t.lab.handle({ type: 'setSpeed', speed: 3600 });
    // เติมน้ำ 5 โดสจนล้น → EC ถูกเจือจางต่ำกว่า 1.0
    for (let i = 0; i < 5; i++) await t.lab.handle({ type: 'dose', device: 'refill' });
    await runReal(t, 24_000); // 1 วันจำลอง
    // ถังเริ่มว่าง 5 โดสได้ ~50 % → EC ยังเข้มจากปุ๋ยรองก้น (ด่าน 1 ต้องเติมถึง 65 % ขึ้นไปเอง)
    expect(envEc(t.lab.sim.env)).toBeGreaterThan(1.6);
    expect(t.lab.events.list().some((e) => e.message.startsWith('ผู้ช่วยฟาร์ม: ใส่ปุ๋ย'))).toBe(false);
    expect(t.lab.snapshot().doses.every((d) => d.device === 'refill')).toBe(true);
  }, 30000);

  it('reset and PLC mode change clear pending doses', async () => {
    const t = await manualLab();
    await t.lab.handle({ type: 'pause' });
    await t.lab.handle({ type: 'dose', device: 'refill' });
    await t.lab.handle({ type: 'setPlcMode', mode: 'auto' });
    expect(t.lab.snapshot().doses).toEqual([]);
    await t.lab.handle({ type: 'setPlcMode', mode: 'manual' });
    await t.lab.handle({ type: 'dose', device: 'refill' });
    await t.lab.handle({ type: 'reset' });
    expect(t.lab.snapshot().doses).toEqual([]);
  });
});
