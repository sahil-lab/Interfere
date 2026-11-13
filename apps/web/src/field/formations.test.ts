import { describe, expect, it } from 'vitest';
import {
  SCOPE_HALF_DEPTH,
  SCOPE_HALF_WIDTH,
  STRIDE,
  buildGeometry,
} from './formations';

describe('the generative field geometry', () => {
  it('is deterministic, so the artwork is identical on every load', () => {
    const first = buildGeometry(32, 48);
    const second = buildGeometry(32, 48);

    expect(first.count).toBe(32 * 48);
    expect(first.data).toHaveLength(first.count * STRIDE);
    expect(Array.from(first.data)).toEqual(Array.from(second.data));
    expect(Array.from(first.lines)).toEqual(Array.from(second.lines));
  });

  it('keeps every formation finite and inside the bounds the renderer fits', () => {
    const { data, count } = buildGeometry(40, 64);
    let finite = true;
    const farthest = { tangle: 0, loop: 0, scopeX: 0, scopeZ: 0, print: 0 };
    let seedLow = Infinity;
    let seedHigh = -Infinity;

    for (let point = 0; point < count; point++) {
      const at = point * STRIDE;
      for (let field = 0; field < STRIDE; field++) {
        finite &&= Number.isFinite(data[at + field]);
      }
      const radius = (offset: number) =>
        Math.hypot(
          data[at + offset]!,
          data[at + offset + 1]!,
          data[at + offset + 2]!,
        );
      farthest.tangle = Math.max(farthest.tangle, radius(0));
      farthest.loop = Math.max(farthest.loop, radius(3));
      farthest.scopeX = Math.max(farthest.scopeX, Math.abs(data[at + 6]!));
      farthest.scopeZ = Math.max(farthest.scopeZ, Math.abs(data[at + 8]!));
      farthest.print = Math.max(farthest.print, radius(9));
      for (let field = 12; field < STRIDE; field++) {
        seedLow = Math.min(seedLow, data[at + field]!);
        seedHigh = Math.max(seedHigh, data[at + field]!);
      }
    }

    expect(finite).toBe(true);
    expect(farthest.tangle).toBeLessThanOrEqual(1.06);
    expect(farthest.loop).toBeLessThanOrEqual(1.01);
    expect(farthest.scopeX).toBeLessThanOrEqual(SCOPE_HALF_WIDTH + 1e-6);
    expect(farthest.scopeZ).toBeLessThanOrEqual(SCOPE_HALF_DEPTH + 1e-6);
    expect(farthest.print).toBeLessThanOrEqual(1.06);
    expect(seedLow).toBeGreaterThanOrEqual(0);
    expect(seedHigh).toBeLessThanOrEqual(1);
  });

  it('draws the fingerprint on every side of its core', () => {
    const { data, count } = buildGeometry(72, 96);
    const quadrants = [0, 0, 0, 0];
    for (let point = 0; point < count; point++) {
      const x = data[point * STRIDE + 9]!;
      const y = data[point * STRIDE + 10]! - 0.16;
      quadrants[(x < 0 ? 1 : 0) + (y < 0 ? 2 : 0)]! += 1;
    }

    for (const share of quadrants) {
      expect(share / count).toBeGreaterThan(0.15);
    }
    expect(quadrants[0]! / quadrants[1]!).toBeCloseTo(1, 0);
    expect(quadrants[2]! / quadrants[3]!).toBeCloseTo(1, 0);
  });

  it('shuffles points so a reduced draw count still covers every strand', () => {
    const strands = 32;
    const { data, count } = buildGeometry(strands, 48);
    const seen = new Set<number>();
    for (let point = 0; point < count / 4; point++) {
      seen.add(Math.round(data[point * STRIDE + 17]! * strands));
    }

    expect(seen.size).toBe(strands);
  });

  it('joins only neighbouring points of the same strand into lines', () => {
    const strands = 12;
    const perStrand = 40;
    const { data, lines, strandIndices } = buildGeometry(strands, perStrand);

    expect(strandIndices).toBe((perStrand - 1) * 2);
    expect(lines).toHaveLength(strands * strandIndices);
    for (let pair = 0; pair < lines.length; pair += 2) {
      const from = lines[pair]! * STRIDE;
      const to = lines[pair + 1]! * STRIDE;
      expect(data[to + 17]).toBe(data[from + 17]);
      expect(data[to + 16]! - data[from + 16]!).toBeCloseTo(1 / perStrand, 5);
    }
  });

  it('orders strand lines so that a drawn prefix is spread across the field', () => {
    const strands = 48;
    const perStrand = 16;
    const { data, lines, strandIndices } = buildGeometry(strands, perStrand);
    const lanes: number[] = [];
    for (let strand = 0; strand < strands / 2; strand++) {
      lanes.push(data[lines[strand * strandIndices]! * STRIDE + 17]!);
    }

    expect(new Set(lanes).size).toBe(strands / 2);
    expect(Math.min(...lanes)).toBeLessThan(0.2);
    expect(Math.max(...lanes)).toBeGreaterThan(0.8);
  });
});
