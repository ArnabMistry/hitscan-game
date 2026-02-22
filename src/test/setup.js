import '@testing-library/jest-dom/vitest';

HTMLCanvasElement.prototype.getContext = () => ({
  setTransform: () => {},
  save: () => {},
  restore: () => {},
  scale: () => {},
  fillRect: () => {},
  strokeRect: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  stroke: () => {},
  arc: () => {},
  fill: () => {},
  drawImage: () => {},
  fillText: () => {},
  clearRect: () => {},
});
