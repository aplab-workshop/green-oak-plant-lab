import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  SimClock,
  hourOfDay,
  initialEnvironment,
  minuteOfDay,
  simDay,
  simTimeFrom,
  stepEnvironment,
  type EnvironmentState,
} from '../src';
import { OFF } from './helpers';

const START = simTimeFrom(14, 6);
const cfg = DEFAULT_CONFIG;

function newClock(speed: 1 | 60 | 360 = 360, maxStepsPerTick = 1_000_000) {
  return new SimClock({ startS: START, dtS: 1, maxStepsPerTick, speed });
}

/** รัน Environment ผ่าน Clock ตามลำดับ tick (ms) ที่กำหนด */
function runWithTicks(ticksMs: number[]): { env: EnvironmentState; simTimeS: number } {
  const clock = newClock(360);
  let env = initialEnvironment(cfg, START);
  const cmd = { ...OFF, ledPct: 80, refillPump: true, fan: true };
  for (const ms of ticksMs) {
    clock.advance(ms, (dt, t) => {
      env = stepEnvironment(env, { cmd, simTimeS: t, plantUptakeDemandL: 0.00001 }, dt, cfg).state;
    });
  }
  return { env, simTimeS: clock.simTimeS };
}

describe('SimClock', () => {
  it('advances simulated time by real time × speed with fixed dt', () => {
    const clock = newClock(60);
    let calls = 0;
    const r = clock.advance(1000, (dt) => {
      expect(dt).toBe(1);
      calls++;
    });
    expect(r).toEqual({ steps: 60, lagged: false });
    expect(calls).toBe(60);
    expect(clock.simTimeS).toBe(START + 60);
  });

  it('does not advance while paused, resumes afterwards', () => {
    const clock = newClock(360);
    clock.pause();
    expect(clock.advance(1000, () => {}).steps).toBe(0);
    expect(clock.simTimeS).toBe(START);
    clock.resume();
    expect(clock.advance(1000, () => {}).steps).toBe(360);
  });

  it('accumulates fractional steps across small ticks at 1x', () => {
    const clock = newClock(1);
    let steps = 0;
    for (let i = 0; i < 10; i++) steps += clock.advance(100, () => {}).steps;
    expect(steps).toBe(1);
    expect(clock.simTimeS).toBe(START + 1);
  });

  it('caps steps per tick and drops backlog (no spiral of death)', () => {
    const clock = newClock(360, 100);
    const r = clock.advance(1000, () => {});
    expect(r).toEqual({ steps: 100, lagged: true });
    // backlog ถูกทิ้ง tick ถัดไปไม่ต้องตามเวลาที่ค้าง
    expect(clock.advance(100, () => {}).steps).toBe(36);
  });

  it('rejects unsupported speeds and resets time', () => {
    const clock = newClock();
    expect(() => clock.setSpeed(10 as never)).toThrow();
    clock.advance(1000, () => {});
    clock.reset();
    expect(clock.simTimeS).toBe(START);
  });

  // AC-07
  it('AC-07: result is identical regardless of how real time is split into ticks', () => {
    // รวม 10 วินาทีจริง × 360 = 3600 วินาทีจำลอง
    const single = runWithTicks([10_000]);
    const even = runWithTicks(Array.from({ length: 100 }, () => 100));
    const uneven = runWithTicks([7, 993, 250, 250, 1500, 3, 997, 2000, 4000]);
    expect(single.simTimeS).toBe(START + 3600);
    expect(even.simTimeS).toBe(single.simTimeS);
    expect(uneven.simTimeS).toBe(single.simTimeS);
    expect(even.env).toEqual(single.env);
    expect(uneven.env).toEqual(single.env);
  });
});

describe('time helpers', () => {
  it('converts simulated seconds to day / minute / hour', () => {
    const t = simTimeFrom(14, 6, 30);
    expect(simDay(t)).toBe(14);
    expect(minuteOfDay(t)).toBe(390);
    expect(hourOfDay(t)).toBeCloseTo(6.5);
    expect(minuteOfDay(simTimeFrom(15, 23, 59))).toBe(1439);
  });
});
