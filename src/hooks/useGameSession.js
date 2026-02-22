import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GAME_MODE } from '../app/modes.js';
import { createGameEngine } from '../engine/gameEngine.js';

const IDLE_DIAGNOSTICS = {
  deltaY: 0,
  gunPose: false,
  shoot: false,
  indexExtended: false,
  middleExtended: false,
  ringExtended: false,
  pinkyExtended: false,
  fps: 0,
};

function getErrorMessage(cause) {
  if (cause instanceof Error) {
    return cause.message;
  }

  if (typeof cause === 'string' && cause.length > 0) {
    return cause;
  }

  if (cause && typeof cause === 'object') {
    const named = cause.name ? String(cause.name) : '';
    const messaged = cause.message ? String(cause.message) : '';

    if (named && messaged) {
      return `${named}: ${messaged}`;
    }
    if (messaged) {
      return messaged;
    }
    if (named) {
      return named;
    }
    try {
      const serialized = JSON.stringify(cause);
      if (serialized && serialized !== '{}') {
        return serialized;
      }
    } catch {
      return Object.prototype.toString.call(cause);
    }
  }

  const fallback = String(cause);
  if (fallback && fallback !== '[object Object]' && fallback !== 'undefined') {
    return fallback;
  }

  return 'Unknown startup failure (non-standard thrown value)';
}

export function useGameSession(videoRef) {
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [debug, setDebug] = useState(true);
  const [mode, setMode] = useState(GAME_MODE.TRAINING);
  const [handedness, setHandedness] = useState('right');
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [diagnostics, setDiagnostics] = useState(IDLE_DIAGNOSTICS);

  const runtimeRef = useRef({
    engine: createGameEngine(),
    tracker: null,
    gesture: null,
    previousFrame: null,
    lastGesture: IDLE_DIAGNOSTICS,
    lastFps: 0,
    video: null,
  });

  useEffect(() => {
    const runtime = runtimeRef.current;
    const offScore = runtime.engine.on('score', (nextScore) => {
      setScore(() => nextScore);
    });

    const offWave = runtime.engine.on('waveChange', (nextWave) => {
      setWave(() => nextWave);
    });

    return () => {
      offScore();
      offWave();
    };
  }, []);

  useEffect(
    () => () => {
      const tracker = runtimeRef.current.tracker;
      if (tracker) {
        tracker.stop();
      }
    },
    [],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      const runtime = runtimeRef.current;
      const last = runtime.lastGesture;
      setDiagnostics({
        deltaY: Number((last.deltaY ?? 0).toFixed(4)),
        gunPose: Boolean(last.gunPose),
        shoot: Boolean(last.shoot),
        indexExtended: Boolean(last.indexExtended),
        middleExtended: Boolean(last.middleExtended),
        ringExtended: Boolean(last.ringExtended),
        pinkyExtended: Boolean(last.pinkyExtended),
        fps: runtime.lastFps,
      });
    }, 100);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const start = useCallback(async () => {
    if (loading || running) {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      setError('Video element is unavailable.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [{ createHandTracker }, { createGestureDetector }] = await Promise.all([
        import('../engine/handTracker.js'),
        import('../engine/gestureDetector.js'),
      ]);

      const runtime = runtimeRef.current;
      if (runtime.tracker) {
        runtime.tracker.stop();
      }

      const tracker = createHandTracker({
        video,
        handedness,
      });

      const gesture = createGestureDetector();

      runtime.tracker = tracker;
      runtime.gesture = gesture;
      runtime.previousFrame = null;
      runtime.video = video;

      await tracker.start();

      runtime.engine.reset();
      runtime.engine.start();
      setScore(0);
      setWave(1);
      setPaused(false);
      setRunning(true);
    } catch (cause) {
      // Keep raw startup error visible for browser-console diagnostics.
      console.error('Gesture startup failure:', cause);

      const runtime = runtimeRef.current;
      if (runtime.tracker) {
        runtime.tracker.stop();
        runtime.tracker = null;
      }
      runtime.gesture = null;
      runtime.previousFrame = null;

      const message = getErrorMessage(cause);
      setError(`Startup failed: ${message}`);
      setRunning(false);
    } finally {
      setLoading(false);
    }
  }, [handedness, loading, running, videoRef]);

  const togglePause = useCallback(() => {
    if (!running) {
      return;
    }

    setPaused((previous) => {
      const next = !previous;
      const engine = runtimeRef.current.engine;
      if (next) {
        engine.pause();
      } else {
        engine.start();
      }
      return next;
    });
  }, [running]);

  const stop = useCallback(() => {
    const runtime = runtimeRef.current;
    runtime.engine.pause();
    runtime.previousFrame = null;
    runtime.lastGesture = IDLE_DIAGNOSTICS;

    if (runtime.tracker) {
      runtime.tracker.stop();
      runtime.tracker = null;
    }

    runtime.gesture = null;
    setRunning(false);
    setPaused(false);
  }, []);

  const updateHandedness = useCallback((next) => {
    setHandedness(() => next);
    const tracker = runtimeRef.current.tracker;
    if (tracker) {
      tracker.setHandedness(next);
    }
  }, []);

  const updateMode = useCallback((next) => {
    setMode(() => next);
    setDebug(() => next === GAME_MODE.TRAINING);
  }, []);

  const api = useMemo(
    () => ({
      runtimeRef,
      start,
      stop,
      togglePause,
      setDebug,
      setMode: updateMode,
      setHandedness: updateHandedness,
    }),
    [start, stop, togglePause, updateHandedness, updateMode],
  );

  const state = {
    running,
    paused,
    loading,
    error,
    debug,
    mode,
    handedness,
    score,
    wave,
    diagnostics,
  };

  return { state, api };
}
