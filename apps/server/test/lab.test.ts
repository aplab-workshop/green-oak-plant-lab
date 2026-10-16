import { describe, expect, it } from 'vitest';
import { levelPct } from '@gol/sim-core';
import { FAILSAFE_COMMANDS } from '../src/plc/failsafe';
import { makeLab, runReal } from './helpers';

describe('Lab isolation — AC-08', () => {
  it('changing or resetting Lab 01 does not change Lab 02', async () => {
    // lab02 กับ control ถูกขับเหมือนกันทุกประการ ส่วน lab01 ถูกรบกวน
    const lab01 = makeLab('lab01', 'manual', 1);
    const lab02 = makeLab('lab02', 'auto', 2);
    const control = makeLab('lab02', 'auto', 2);

    for (const t of [lab01, lab02, control]) await t.lab.handle({ type: 'setSpeed', speed: 360 });
    await lab01.lab.handle({ type: 'applyScenario', scenarioId: 'water-shortage' });
    await lab01.lab.handle({ type: 'setManualBit', key: 'refillPump', value: true });

    await runReal(lab01, 5000);
    await runReal(lab02, 5000);
    await runReal(control, 5000);
    await lab01.lab.handle({ type: 'reset' });
    await lab01.lab.handle({ type: 'pause' });
    await runReal(lab01, 2000);
    await runReal(lab02, 2000);
    await runReal(control, 2000);

    const a = lab02.lab.snapshot();
    const b = control.lab.snapshot();
    expect(a.plants).toEqual(b.plants);
    expect(a.tank).toEqual(b.tank);
    expect(a.simTimeS).toBe(b.simTimeS);
    expect(a.scenario).toBeNull();
    expect(lab01.lab.snapshot().paused).toBe(true);
  });
});

describe('PLC-in-the-loop — AC-09', () => {
  it('Sim → Mock PLC (auto) → Sim keeps the water level within the hysteresis band for 3 days', async () => {
    const t = makeLab('lab01', 'auto');
    await t.lab.handle({ type: 'applyScenario', scenarioId: 'water-shortage' }); // รั่ว 1.5 L/h
    await t.lab.handle({ type: 'setSpeed', speed: 360 });
    await t.lab.poll();

    const levels: number[] = [];
    let refillCycles = 0;
    let prevRefill = false;
    // 3 วันจำลอง ที่ 360x = 720 วินาทีจริง
    for (let i = 0; i < 720; i++) {
      await runReal(t, 1000);
      const s = t.lab.snapshot();
      levels.push(s.tank.waterLevelPct);
      if (s.commands.refillPump && !prevRefill) refillCycles++;
      prevRefill = s.commands.refillPump;
    }

    const s = t.lab.snapshot();
    expect(s.sim.day).toBe(17);
    expect(refillCycles).toBeGreaterThan(5);
    // ต่ำสุดไม่ต่ำกว่า 70% มากเกินไป (Poll ทุก 500 ms จริง = 3 นาทีจำลอง)
    expect(Math.min(...levels.slice(10))).toBeGreaterThan(65);
    expect(Math.max(...levels)).toBeLessThanOrEqual(100);
    for (const p of s.plants) {
      expect(p.damage).toBe(0);
      expect(p.waterStress).toBeLessThan(0.1);
    }
    expect(s.failsafe).toBe(false);
  });

  it('without PLC refill the water-shortage scenario stresses the plants', async () => {
    const t = makeLab('lab01', 'manual');
    await t.lab.handle({ type: 'applyScenario', scenarioId: 'water-shortage' });
    await t.lab.handle({ type: 'setSpeed', speed: 360 });
    await runReal(t, 120_000); // 12 ชั่วโมงจำลอง
    const s = t.lab.snapshot();
    expect(s.tank.waterLevelPct).toBeLessThan(50);
    expect(Math.max(...s.plants.map((p) => p.waterStress))).toBeGreaterThan(0.3);
    expect(t.lab.events.list().some((e) => e.kind === 'plant.water_stress')).toBe(true);
  });
});

describe('Fail-safe — AC-10', () => {
  it('stale commands trigger fail-safe while the simulation keeps running, then recover', async () => {
    const t = makeLab('lab01', 'manual');
    await t.lab.handle({ type: 'setManualBit', key: 'refillPump', value: true });
    await t.lab.handle({ type: 'setManualLed', value: 70 });
    await runReal(t, 1000);
    expect(t.lab.isFailsafe).toBe(false);
    expect(t.lab.commands).toMatchObject({ refillPump: true, ledPct: 70 });

    // สายหลุด
    await t.lab.handle({ type: 'setPlcMode', mode: 'offline' });
    const before = t.lab.sim.simTimeS;
    await runReal(t, 2500);
    expect(t.lab.isFailsafe).toBe(false); // ยังไม่เกิน 3 วินาที

    await runReal(t, 1500);
    expect(t.lab.isFailsafe).toBe(true);
    expect(t.lab.commands).toEqual(FAILSAFE_COMMANDS);
    expect(t.lab.sim.simTimeS).toBeGreaterThan(before); // Simulation ยังเดิน
    const level = levelPct(t.lab.sim.env.waterVolumeL, t.lab.sim.cfg);
    await runReal(t, 2000);
    // Refill ปิดแล้ว ระดับน้ำไม่เพิ่ม
    expect(levelPct(t.lab.sim.env.waterVolumeL, t.lab.sim.cfg)).toBeLessThanOrEqual(level);

    const kinds = t.lab.events.list().map((e) => e.kind);
    expect(kinds).toContain('plc.comm_error');
    expect(kinds).toContain('plc.failsafe');
    expect(t.lab.snapshot().plc.connection).toBe('offline');

    // กลับมาออนไลน์ → ใช้คำสั่งใหม่จาก PLC
    await t.lab.handle({ type: 'setPlcMode', mode: 'manual' });
    await runReal(t, 600);
    expect(t.lab.isFailsafe).toBe(false);
    expect(t.lab.events.list().map((e) => e.kind)).toContain('plc.comm_restored');
  });

  it('starts in fail-safe until the first successful PLC read', async () => {
    const t = makeLab('lab01', 'offline');
    expect(t.lab.isFailsafe).toBe(true);
    await runReal(t, 5000);
    expect(t.lab.commands).toEqual(FAILSAFE_COMMANDS);
    expect(t.lab.sim.simTimeS).toBeGreaterThan(t.lab.sim.startTimeS);
  });
});

describe('Lab commands', () => {
  it('pause stops simulated time and resume continues it', async () => {
    const t = makeLab();
    await t.lab.handle({ type: 'pause' });
    const t0 = t.lab.sim.simTimeS;
    await runReal(t, 1000);
    expect(t.lab.sim.simTimeS).toBe(t0);
    await t.lab.handle({ type: 'resume' });
    await runReal(t, 1000);
    expect(t.lab.sim.simTimeS).toBe(t0 + 1);
  });

  it('logs actuator changes with their PLC address', async () => {
    const t = makeLab('lab01', 'manual');
    await t.lab.handle({ type: 'setManualBit', key: 'fan', value: true });
    expect(t.lab.events.list().some((e) => e.message === 'Ventilation Fan (M100): ON')).toBe(true);
  });

  it('reset keeps the current scenario and clears history', async () => {
    const t = makeLab();
    await t.lab.handle({ type: 'applyScenario', scenarioId: 'water-shortage' });
    await t.lab.handle({ type: 'setSpeed', speed: 360 });
    await runReal(t, 10_000);
    await t.lab.handle({ type: 'reset' });
    const s = t.lab.snapshot();
    expect(s.scenario?.id).toBe('water-shortage');
    expect(s.simTimeS).toBe(t.lab.sim.startTimeS);
    expect(t.lab.history.list()).toHaveLength(1);
    await t.lab.handle({ type: 'clearScenario' });
    expect(t.lab.snapshot().disturbance.leakLph).toBe(0);
  });
});
