import { useRef } from 'react';
import { ControlPanel } from './components/ControlPanel.jsx';
import { DebugPanel } from './components/DebugPanel.jsx';
import { GameCanvas } from './components/GameCanvas.jsx';
import { Hud } from './components/Hud.jsx';
import { useGameSession } from './hooks/useGameSession.js';

function App() {
  const videoRef = useRef(null);
  const { state, api } = useGameSession(videoRef);

  return (
    <div className="app-shell">
      <video ref={videoRef} className="camera-source" playsInline muted aria-hidden="true" />

      <header className="top-row">
        <h1>Gesture Ballistics Interface</h1>
        <Hud score={state.score} wave={state.wave} running={state.running} paused={state.paused} />
      </header>

      <main className="main-grid">
        <GameCanvas
          runtimeRef={api.runtimeRef}
          running={state.running}
          paused={state.paused}
          debug={state.debug}
          mode={state.mode}
        />

        <aside className="sidebar">
          <ControlPanel
            running={state.running}
            paused={state.paused}
            loading={state.loading}
            debug={state.debug}
            mode={state.mode}
            handedness={state.handedness}
            onStart={api.start}
            onStop={api.stop}
            onPause={api.togglePause}
            onDebug={api.setDebug}
            onMode={api.setMode}
            onHandedness={api.setHandedness}
          />

          {state.error ? <p className="error">{state.error}</p> : null}
          <DebugPanel enabled={state.debug} diagnostics={state.diagnostics} />
        </aside>
      </main>
    </div>
  );
}

export default App;
