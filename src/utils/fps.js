import { lerp } from './math.js';

export function createFpsCounter(smoothing = 0.12) {
  let lastNow = 0;
  let smoothedFps = 60;

  function update(now) {
    if (lastNow === 0) {
      lastNow = now;
      return Math.round(smoothedFps);
    }

    const dtMs = now - lastNow;
    lastNow = now;
    if (dtMs <= 0) {
      return Math.round(smoothedFps);
    }

    const instant = 1000 / dtMs;
    smoothedFps = lerp(smoothedFps, instant, smoothing);
    return Math.round(smoothedFps);
  }

  return { update };
}
