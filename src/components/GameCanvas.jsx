import { useEffect, useRef } from 'react';
import {
  COLOR_ACCENT,
  COLOR_BG,
  COLOR_DEBUG,
  COLOR_FG,
  COLOR_MUTED,
  DEBUG_PREVIEW_HEIGHT,
  DEBUG_PREVIEW_WIDTH,
  POINTER_SIZE,
  POINTER_STROKE,
  VECTOR_LINE_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../app/constants.js';
import { GAME_MODE } from '../app/modes.js';
import { useRafLoop } from '../hooks/useRafLoop.js';
import { createFpsCounter } from '../utils/fps.js';

const LANDMARK_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

function configureCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext('2d');
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return context;
}

function clearBackground(ctx, width, height) {
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, width, height);
}

function drawTargets(ctx, targets) {
  ctx.strokeStyle = COLOR_ACCENT;
  ctx.lineWidth = 2;

  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    const side = target.radius * 1.7;
    ctx.strokeRect(target.x - side / 2, target.y - side / 2, side, side);
  }
}

function drawPointer(ctx, pointer, showHelper, direction, nowMs) {
  if (!pointer.visible) {
    return;
  }

  const flashing = nowMs < (pointer.flashUntil ?? 0);
  const size = (pointer.size ?? POINTER_SIZE) + (flashing ? 4 : 0);
  const x = pointer.x;
  const y = pointer.y;

  ctx.strokeStyle = flashing ? '#ffffff' : pointer.locked ? '#00ffff' : COLOR_FG;
  ctx.lineWidth = POINTER_STROKE;
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.lineTo(x + size, y);
  ctx.moveTo(x, y - size);
  ctx.lineTo(x, y + size);
  ctx.stroke();

  if (showHelper && direction && direction.mag > 0) {
    ctx.strokeStyle = COLOR_MUTED;
    ctx.lineWidth = VECTOR_LINE_WIDTH;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + direction.x * 80, y + direction.y * 80);
    ctx.stroke();
  }
}

function drawDebugOverlay(ctx, canvasWidth, video, trackerState, gesture, fps) {
  const x = canvasWidth - DEBUG_PREVIEW_WIDTH - 16;
  const y = 16;

  ctx.fillStyle = '#050505';
  ctx.fillRect(x, y, DEBUG_PREVIEW_WIDTH, DEBUG_PREVIEW_HEIGHT);
  ctx.strokeStyle = COLOR_DEBUG;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, DEBUG_PREVIEW_WIDTH, DEBUG_PREVIEW_HEIGHT);

  if (video && video.readyState >= 2) {
    ctx.save();
    ctx.translate(x + DEBUG_PREVIEW_WIDTH, y);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, DEBUG_PREVIEW_WIDTH, DEBUG_PREVIEW_HEIGHT);
    ctx.restore();
  }

  const landmarks = trackerState?.landmarks;
  if (landmarks && landmarks.length === 21) {
    ctx.strokeStyle = COLOR_DEBUG;
    for (let i = 0; i < LANDMARK_CONNECTIONS.length; i += 1) {
      const connection = LANDMARK_CONNECTIONS[i];
      const a = landmarks[connection[0]];
      const b = landmarks[connection[1]];
      const ax = x + (1 - a.x) * DEBUG_PREVIEW_WIDTH;
      const ay = y + a.y * DEBUG_PREVIEW_HEIGHT;
      const bx = x + (1 - b.x) * DEBUG_PREVIEW_WIDTH;
      const by = y + b.y * DEBUG_PREVIEW_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }

    for (let i = 0; i < landmarks.length; i += 1) {
      const point = landmarks[i];
      const px = x + (1 - point.x) * DEBUG_PREVIEW_WIDTH;
      const py = y + point.y * DEBUG_PREVIEW_HEIGHT;
      ctx.fillStyle = i === 0 ? '#ffdf00' : i === 8 ? '#ff3300' : COLOR_DEBUG;
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    const wrist = landmarks[0];
    const indexTip = landmarks[8];
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + (1 - wrist.x) * DEBUG_PREVIEW_WIDTH, y + wrist.y * DEBUG_PREVIEW_HEIGHT);
    ctx.lineTo(x + (1 - indexTip.x) * DEBUG_PREVIEW_WIDTH, y + indexTip.y * DEBUG_PREVIEW_HEIGHT);
    ctx.stroke();
  }

  ctx.fillStyle = COLOR_FG;
  ctx.font = '12px "IBM Plex Mono", monospace';
  ctx.fillText(`FPS ${fps}`, x + 8, y + DEBUG_PREVIEW_HEIGHT + 16);
  ctx.fillText(`deltaY ${gesture?.deltaY?.toFixed(4) ?? '0.0000'}`, x + 8, y + DEBUG_PREVIEW_HEIGHT + 32);
  ctx.fillText(`gunPose ${String(Boolean(gesture?.gunPose))}`, x + 8, y + DEBUG_PREVIEW_HEIGHT + 48);
  ctx.fillText(`shoot ${String(Boolean(gesture?.shoot))}`, x + 8, y + DEBUG_PREVIEW_HEIGHT + 64);
}

function drawIdle(ctx, width, height) {
  clearBackground(ctx, width, height);
  ctx.strokeStyle = '#1f1f1f';
  ctx.lineWidth = 1;

  for (let x = 0; x < width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y < height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.fillStyle = COLOR_MUTED;
  ctx.font = '16px "IBM Plex Mono", monospace';
  ctx.fillText('Press START to arm webcam + hand tracking', 24, 36);
}

export function GameCanvas({ runtimeRef, running, paused, debug, mode }) {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const prevNowRef = useRef(0);
  const fpsRef = useRef(createFpsCounter());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const setup = () => {
      contextRef.current = configureCanvas(canvas);
    };

    setup();
    window.addEventListener('resize', setup);
    return () => {
      window.removeEventListener('resize', setup);
    };
  }, []);

  useRafLoop(
    (now) => {
      const ctx = contextRef.current;
      const canvas = canvasRef.current;
      if (!ctx || !canvas) {
        return;
      }

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const scaleX = width / WORLD_WIDTH;
      const scaleY = height / WORLD_HEIGHT;

      const previousNow = prevNowRef.current || now;
      prevNowRef.current = now;
      const dt = (now - previousNow) / 1000;

      const runtime = runtimeRef.current;
      const fps = fpsRef.current.update(now);
      runtime.lastFps = fps;

      if (running && !paused && runtime.tracker && runtime.gesture) {
        const trackerState = runtime.tracker.getState();
        const previousFrame = runtime.previousFrame;
        const gesture = runtime.gesture.evaluate(previousFrame, trackerState, now);

        runtime.previousFrame = trackerState.hasHand ? { landmarks: trackerState.landmarks } : null;
        runtime.lastGesture = gesture;

        runtime.engine.update(dt, trackerState, gesture, now);
      }

      const snapshot = runtime.engine.getSnapshot();

      ctx.save();
      ctx.scale(scaleX, scaleY);
      clearBackground(ctx, WORLD_WIDTH, WORLD_HEIGHT);

      if (!running) {
        drawIdle(ctx, WORLD_WIDTH, WORLD_HEIGHT);
      } else {
        drawTargets(ctx, snapshot.targets);
        drawPointer(
          ctx,
          snapshot.pointer,
          mode === GAME_MODE.TRAINING,
          runtime.lastGesture?.direction,
          now,
        );

        if (debug) {
          drawDebugOverlay(
            ctx,
            WORLD_WIDTH,
            runtime.video,
            runtime.tracker?.getState(),
            runtime.lastGesture,
            fps,
          );
        }
      }

      ctx.restore();
    },
    true,
  );

  return <canvas ref={canvasRef} className="game-canvas" aria-label="Gesture shooting canvas" />;
}
