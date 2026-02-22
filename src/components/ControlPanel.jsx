import { GAME_MODE, MODE_OPTIONS } from '../app/modes.js';

const HAND_OPTIONS = [
  { value: 'right', label: 'Right Hand' },
  { value: 'left', label: 'Left Hand' },
];

export function ControlPanel({
  running,
  paused,
  loading,
  debug,
  mode,
  handedness,
  onStart,
  onStop,
  onPause,
  onDebug,
  onMode,
  onHandedness,
}) {
  return (
    <section className="control-panel" aria-label="Control panel">
      <div className="button-row">
        <button type="button" onClick={onStart} disabled={loading || running}>
          {loading ? 'Arming...' : 'Start'}
        </button>
        <button type="button" onClick={onPause} disabled={!running}>
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button type="button" onClick={onStop} disabled={!running && !paused}>
          Stop
        </button>
      </div>

      <div className="field-grid">
        <label>
          <span>Mode</span>
          <select value={mode} onChange={(event) => onMode(event.target.value)}>
            {MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Hand</span>
          <select value={handedness} onChange={(event) => onHandedness(event.target.value)}>
            {HAND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="toggle">
          <span>Debug</span>
          <input
            type="checkbox"
            checked={debug}
            onChange={(event) => onDebug(event.target.checked)}
            disabled={mode === GAME_MODE.LIVE_FIRE}
          />
        </label>
      </div>
    </section>
  );
}
