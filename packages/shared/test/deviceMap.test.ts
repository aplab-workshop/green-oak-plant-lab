import { describe, expect, it } from 'vitest';
import { COMMAND_BITS, LED_COMMAND_REGISTER, SENSOR_REGISTERS, WRITABLE_D_ADDRESSES, fromRaw, toRaw } from '../src';

const reg = (key: string) => {
  const r = SENSOR_REGISTERS.find((x) => x.key === key);
  if (!r) throw new Error(`no register ${key}`);
  return r;
};

describe('deviceMap', () => {
  it('maps sensors to D100–D110 in order', () => {
    expect(SENSOR_REGISTERS.map((r) => r.address)).toEqual([100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110]);
  });

  it('scales values per DEVICE-MAP.md examples', () => {
    expect(toRaw(reg('airTempC'), 25.3)).toEqual({ raw: 253, clamped: false });
    expect(toRaw(reg('ph'), 6.05).raw).toBe(605);
    expect(toRaw(reg('ecMsCm'), 1.2).raw).toBe(120);
    expect(toRaw(reg('dli'), 14.4).raw).toBe(1440);
    expect(fromRaw(reg('rhPct'), 655)).toBeCloseTo(65.5);
  });

  it('clamps out-of-range and non-finite values', () => {
    expect(toRaw(reg('waterLevelPct'), 120)).toEqual({ raw: 100, clamped: true });
    expect(toRaw(reg('ppfd'), -5)).toEqual({ raw: 0, clamped: true });
    expect(toRaw(reg('airTempC'), Number.NaN).clamped).toBe(true);
  });

  it('writable allowlist contains only sensor, sim-info and heartbeat registers', () => {
    expect([...WRITABLE_D_ADDRESSES].sort((a, b) => a - b)).toEqual([
      100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 120,
    ]);
    expect(WRITABLE_D_ADDRESSES.has(LED_COMMAND_REGISTER.address)).toBe(false);
  });

  it('maps commands to M100–M105', () => {
    expect(COMMAND_BITS.map((b) => b.address)).toEqual([100, 101, 102, 103, 104, 105]);
  });
});
