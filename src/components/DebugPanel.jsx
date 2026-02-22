export function DebugPanel({ enabled, diagnostics }) {
  if (!enabled) {
    return null;
  }

  return (
    <section className="debug-panel" aria-label="Debug metrics">
      <div>FPS {diagnostics.fps}</div>
      <div>deltaY {diagnostics.deltaY}</div>
      <div>indexExtended {String(diagnostics.indexExtended)}</div>
      <div>middleExtended {String(diagnostics.middleExtended)}</div>
      <div>ringExtended {String(diagnostics.ringExtended)}</div>
      <div>pinkyExtended {String(diagnostics.pinkyExtended)}</div>
      <div>gunPose {String(diagnostics.gunPose)}</div>
      <div>shoot {String(diagnostics.shoot)}</div>
    </section>
  );
}
