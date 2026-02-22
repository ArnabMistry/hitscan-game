import { describe, expect, it } from 'vitest';
import { createGameEngine } from '../gameEngine.js';

function visiblePointer(x, y) {
  return { pointer: { x, y, visible: true } };
}

describe('gameEngine', () => {
  it('spawns wave on start and performs hitscan without projectiles', () => {
    const engine = createGameEngine({ width: 640, height: 360 });
    engine.reset();
    engine.start();

    const before = engine.getSnapshot();
    expect(before.targets.length).toBeGreaterThan(0);

    const target = before.targets[0];
    engine.update(
      1 / 60,
      visiblePointer(target.x, target.y),
      { shoot: true, direction: { x: 1, y: 0, mag: 1 } },
      1000,
    );

    const afterShoot = engine.getSnapshot();
    expect(afterShoot.projectiles.length).toBe(0);
    expect(afterShoot.score).toBeGreaterThanOrEqual(1);
  });

  it('keeps targets within bounds through bounce updates', () => {
    const engine = createGameEngine({ width: 640, height: 360 });
    engine.reset();
    engine.start();

    for (let i = 0; i < 300; i += 1) {
      engine.update(1 / 120, { pointer: { visible: false } }, { shoot: false }, 1000 + i * 8);
    }

    const snapshot = engine.getSnapshot();
    for (let i = 0; i < snapshot.targets.length; i += 1) {
      const target = snapshot.targets[i];
      expect(target.x - target.radius).toBeGreaterThanOrEqual(0);
      expect(target.x + target.radius).toBeLessThanOrEqual(640);
      expect(target.y - target.radius).toBeGreaterThanOrEqual(0);
      expect(target.y + target.radius).toBeLessThanOrEqual(360);
    }
  });

  it('emits score event on successful hits', () => {
    const engine = createGameEngine({ width: 640, height: 360 });
    const scores = [];
    engine.on('score', (value) => scores.push(value));

    engine.reset();
    engine.start();

    const snapshot = engine.getSnapshot();
    const target = snapshot.targets[0];
    engine.update(
      1 / 60,
      visiblePointer(target.x, target.y),
      { shoot: true, direction: { x: 0, y: 0, mag: 0 } },
      1000,
    );

    expect(scores.some((value) => value > 0)).toBe(true);
  });
});
