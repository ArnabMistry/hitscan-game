export function clamp(value, min, max) {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function normalize(x, y) {
  const mag = Math.hypot(x, y);
  if (mag === 0) {
    return { x: 0, y: 0, mag: 0 };
  }
  return { x: x / mag, y: y / mag, mag };
}

export function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}
