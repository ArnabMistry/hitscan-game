export function DebugPanel({ enabled, diagnostics }) {
  if (!enabled) {
    return null;
  }

  return (
    <section className="debug-panel" aria-label="Debug metrics">
      <div>FPS {diagnostics.fps}</div>
      <div>deltaY {diagnostics.deltaY}</div>
      <div>gunPose {String(diagnostics.gunPose)}</div>
      <div>shoot {String(diagnostics.shoot)}</div>
    </section>
  );
}
