import { describe, expect, it } from 'vitest';
import { COMMAND_BITS } from '@gol/shared';
import { DEVICE_RATIONALE, PLAYER_DEVICE_KEY } from '../src/dashboard/deviceRationale';

describe('device rationale texts (P34)', () => {
  it('every actuator has a problem, a benefit and a caution', () => {
    const keys = [...COMMAND_BITS.map((b) => b.key), 'ledPct' as const];
    for (const k of keys) {
      const r = DEVICE_RATIONALE[k];
      expect(r.problem.length).toBeGreaterThan(10);
      expect(r.benefit.length).toBeGreaterThan(10);
      expect(r.caution.length).toBeGreaterThan(10);
    }
    expect(Object.values(PLAYER_DEVICE_KEY).every((k) => k in DEVICE_RATIONALE)).toBe(true);
  });

  it('mentions the model rules added in P29–P33', () => {
    expect(DEVICE_RATIONALE.refillPump.caution).toContain('10 ต่อลิตร');
    expect(DEVICE_RATIONALE.ledPct.caution).toContain('18 ชม.');
    expect(DEVICE_RATIONALE.humidifier.problem).toContain('แห้ง');
    expect(DEVICE_RATIONALE.humidifier.caution).toContain('ชื้นจัด');
    expect(DEVICE_RATIONALE.fan.caution).toContain('ไม่ต่ำกว่าห้อง');
  });
});
