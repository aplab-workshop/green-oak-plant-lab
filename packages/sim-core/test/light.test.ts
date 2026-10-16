import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, positionFactor, ppfdAt, simTimeFrom } from '../src';
import { flatRoomConfig, runEnv } from './helpers';

describe('Light — AC-06', () => {
  it('LED 0 % gives PPFD 0 and DLI does not increase', () => {
    const { env, history } = runEnv({ cfg: flatRoomConfig(), cmd: { ledPct: 0 }, hours: 12 });
    expect(env.ppfd).toBe(0);
    expect(history.every((s) => s.dliToday === 0)).toBe(true);
  });

  it('PPFD scales with LED brightness', () => {
    const cfg = flatRoomConfig();
    expect(runEnv({ cfg, cmd: { ledPct: 50 }, hours: 0.01 }).env.ppfd).toBe(200);
    expect(runEnv({ cfg, cmd: { ledPct: 100 }, hours: 0.01 }).env.ppfd).toBe(400);
    // ค่าเกินช่วงถูก clamp
    expect(runEnv({ cfg, cmd: { ledPct: 150 }, hours: 0.01 }).env.ppfd).toBe(400);
  });

  it('DLI accumulates PPFD over simulated time', () => {
    const cfg = flatRoomConfig();
    // 400 µmol/m²/s × 16 h = 23.04 mol/m²
    expect(runEnv({ cfg, cmd: { ledPct: 100 }, hours: 16 }).env.dliToday).toBeCloseTo(23.04, 6);
    expect(runEnv({ cfg, cmd: { ledPct: 50 }, hours: 16 }).env.dliToday).toBeCloseTo(11.52, 6);
  });

  it('DLI resets at simulated midnight and keeps yesterday’s total', () => {
    const cfg = flatRoomConfig();
    const { env } = runEnv({ cfg, cmd: { ledPct: 100 }, hours: 2, startS: simTimeFrom(14, 23) });
    expect(env.dliYesterday).toBeCloseTo(1.44, 6);
    expect(env.dliToday).toBeCloseTo(1.44, 6);
  });

  it('plants at corner positions receive less light than the centre', () => {
    const cfg = DEFAULT_CONFIG;
    expect(ppfdAt(100, positionFactor(1, cfg), cfg)).toBe(400);
    expect(ppfdAt(100, positionFactor(0, cfg), cfg)).toBe(340);
    expect(positionFactor(99, cfg)).toBe(1);
  });
});
