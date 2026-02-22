import { describe, expect, it } from 'vitest';
import { createGestureDetector } from '../gestureDetector.js';

function createPose({ indexExtended = true, middleExtended = true } = {}) {
  const points = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));

  points[0] = { x: 0.5, y: 0.8, z: 0 };
  points[5] = { x: 0.48, y: 0.65, z: 0 };
  points[6] = { x: 0.48, y: indexExtended ? 0.55 : 0.7, z: 0 };
  points[8] = { x: 0.48, y: indexExtended ? 0.35 : 0.75, z: 0 };

  points[10] = { x: 0.52, y: 0.56, z: 0 };
  points[12] = { x: 0.52, y: middleExtended ? 0.3 : 0.7, z: 0 };
  points[14] = { x: 0.54, y: 0.56, z: 0 };
  points[16] = { x: 0.54, y: 0.7, z: 0 };
  points[18] = { x: 0.56, y: 0.56, z: 0 };
  points[20] = { x: 0.56, y: 0.7, z: 0 };

  return { hasHand: true, landmarks: points };
}

describe('gestureDetector', () => {
  it('requires valid gun pose and flick threshold', () => {
    const detector = createGestureDetector({
      thresholds: { flickDeltaY: 0.03, cooldownMs: 100 },
    });

    const previous = createPose({ indexExtended: true });
    previous.landmarks[8].y = 0.48;
    const current = createPose({ indexExtended: true });
    current.landmarks[8].y = 0.38;

    const ok = detector.evaluate(previous, current, 1000);
    expect(ok.gunPose).toBe(true);
    expect(ok.deltaY).toBeGreaterThan(0.03);
    expect(ok.shoot).toBe(true);

    const noPose = detector.evaluate(previous, createPose({ indexExtended: false }), 1200);
    expect(noPose.gunPose).toBe(false);
    expect(noPose.shoot).toBe(false);
  });

  it('enforces cooldown deterministically', () => {
    const detector = createGestureDetector({
      thresholds: { flickDeltaY: 0.01, cooldownMs: 300 },
    });

    const previous = createPose({ indexExtended: true });
    previous.landmarks[8].y = 0.48;
    const current = createPose({ indexExtended: true });
    current.landmarks[8].y = 0.3;

    const first = detector.evaluate(previous, current, 1000);
    const second = detector.evaluate(previous, current, 1100);
    const third = detector.evaluate(previous, current, 1401);

    expect(first.shoot).toBe(true);
    expect(second.shoot).toBe(false);
    expect(second.reason).toBe('cooldown');
    expect(third.shoot).toBe(true);

    expect(first.direction.mag).toBeGreaterThan(0);
  });
});
