import { describe, expect, it } from 'vitest';
import { clamp, distance, lerp, normalize } from '../math.js';

describe('math utils', () => {
  it('normalizes vectors and handles zero vectors', () => {
    expect(normalize(0, 0)).toEqual({ x: 0, y: 0, mag: 0 });

    const unit = normalize(3, 4);
    expect(unit.x).toBeCloseTo(0.6);
    expect(unit.y).toBeCloseTo(0.8);
    expect(unit.mag).toBeCloseTo(5);
  });

  it('computes distance, lerp, and clamp', () => {
    expect(distance(0, 0, 3, 4)).toBeCloseTo(5);
    expect(lerp(10, 20, 0.25)).toBeCloseTo(12.5);
    expect(clamp(5, 0, 4)).toBe(4);
    expect(clamp(-1, 0, 4)).toBe(0);
  });
});
