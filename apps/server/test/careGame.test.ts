import { describe, expect, it } from 'vitest';
import { makeConfig } from '@gol/sim-core';
import { makeLab, runReal } from './helpers';

describe('Care score lifecycle — P17', () => {
  it('is independent of tick splitting; pause and snapshot reads do not add score', async () => {
    const a = makeLab(), b = makeLab();
    for (const t of [a, b]) { await t.lab.handle({ type: 'setSpeed', speed: 60 }); await t.lab.poll(); }
    await runReal(a, 3000, 100); await runReal(b, 3000, 500);
    expect(a.lab.snapshot().game).toEqual(b.lab.snapshot().game);
    await a.lab.handle({ type: 'pause' });
    const game = a.lab.snapshot().game;
    await runReal(a, 10000);
    expect(a.lab.snapshot().game).toEqual(game);
  });

  it('records only eligible completed rounds, keeps best through resets, isolates labs and scenarios', async () => {
    expect(makeConfig().game.recordMinS).toBe(86400);
    const a = makeLab('lab01', 'auto', 1, { cfg: makeConfig({ game: { recordMinS: 10 } }) });
    const b = makeLab('lab02');
    await a.lab.poll(); await runReal(a, 5000);
    a.lab.reset(); expect(a.lab.snapshot().game.best).toBeNull();
    await runReal(a, 15000);
    const before = a.lab.snapshot().game;
    await a.lab.handle({ type: 'applyScenario', scenarioId: 'water-shortage' });
    expect(a.lab.snapshot().game).toMatchObject({ score: 0, elapsedS: 0, best: null });
    await a.lab.handle({ type: 'clearScenario' });
    expect(a.lab.snapshot().game.best).toEqual({ score: before.score, elapsedS: before.elapsedS });
    expect(b.lab.snapshot().game.best).toBeNull();
    const best = a.lab.snapshot().game.best!; best.score = -1;
    expect(a.lab.snapshot().game.best!.score).toBe(before.score);
    a.lab.reset(); expect(a.lab.snapshot().game.best!.score).toBe(before.score);
  });
});
