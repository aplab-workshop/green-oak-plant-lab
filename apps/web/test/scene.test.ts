import { describe, expect, it } from 'vitest';
import { createLeafGeometry, leafHalfWidth } from '../src/scene/leafGeometry';
import { BASE_LEAF_LENGTH, hash01, leafLayout } from '../src/scene/leafLayout';
import { potPosition } from '../src/scene/layout';

describe('leaf geometry', () => {
  it('builds a grid with colours and normals', () => {
    const g = createLeafGeometry(20, 3);
    expect(g.getAttribute('position').count).toBe(21 * 7);
    expect(g.getAttribute('color').count).toBe(21 * 7);
    expect(g.getAttribute('normal')).toBeDefined();
    expect(g.getIndex()!.count).toBe(20 * 6 * 6);
  });

  it('has a narrow petiole and lobed (non-monotonic) edge like an oak leaf', () => {
    expect(leafHalfWidth(0)).toBeLessThan(0.05);
    const samples = Array.from({ length: 200 }, (_, i) => leafHalfWidth(0.2 + (0.6 * i) / 199));
    let turns = 0;
    for (let i = 2; i < samples.length; i++) {
      const a = samples[i - 1]! - samples[i - 2]!;
      const b = samples[i]! - samples[i - 1]!;
      if (a * b < 0) turns++;
    }
    expect(turns).toBeGreaterThanOrEqual(4); // มีหยักหลายลอน
  });
});

describe('leafLayout', () => {
  it('creates one pose per leaf, outer leaves larger and lower than inner', () => {
    const poses = leafLayout(1, 10, 1, 0);
    expect(poses).toHaveLength(10);
    expect(poses[0]!.length).toBeGreaterThan(poses[9]!.length);
    expect(poses[0]!.elevation).toBeLessThan(poses[9]!.elevation);
    expect(poses[0]!.length).toBeCloseTo(BASE_LEAF_LENGTH, 2);
  });

  it('droop lowers every leaf and makes outer leaves hang below horizontal', () => {
    const upright = leafLayout(2, 12, 1.5, 0);
    const wilted = leafLayout(2, 12, 1.5, 1);
    upright.forEach((p, i) => expect(wilted[i]!.elevation).toBeLessThan(p.elevation));
    expect(wilted[0]!.elevation).toBeLessThan(0);
    expect(upright.every((p) => p.elevation > 0)).toBe(true);
  });

  it('is deterministic per plant and scales with plant size', () => {
    expect(leafLayout(3, 8, 1, 0.2)).toEqual(leafLayout(3, 8, 1, 0.2));
    expect(leafLayout(3, 8, 2, 0)[0]!.length).toBeCloseTo(leafLayout(3, 8, 1, 0)[0]!.length * 2);
    expect(hash01(1, 2)).toBeGreaterThanOrEqual(0);
    expect(hash01(1, 2)).toBeLessThan(1);
  });
});

describe('pot layout', () => {
  it('places 6 pots in 3 columns × 2 rows with centre column at x = 0', () => {
    expect(potPosition(1, 6)[0]).toBeCloseTo(0);
    expect(potPosition(4, 6)[0]).toBeCloseTo(0);
    expect(potPosition(0, 6)).toEqual([-0.15, -0.1]);
    expect(potPosition(5, 6)).toEqual([0.15, 0.1]);
  });
});
