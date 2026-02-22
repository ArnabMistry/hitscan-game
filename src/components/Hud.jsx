export function Hud({ score, wave, running, paused }) {
  return (
    <section className="hud" aria-label="HUD">
      <div className="hud-item">
        <span className="hud-label">Score</span>
        <span className="hud-value">{score}</span>
      </div>
      <div className="hud-item">
        <span className="hud-label">Wave</span>
        <span className="hud-value">{wave}</span>
      </div>
      <div className="hud-item">
        <span className="hud-label">State</span>
        <span className="hud-value">{running ? (paused ? 'Paused' : 'Live') : 'Idle'}</span>
      </div>
    </section>
  );
}
