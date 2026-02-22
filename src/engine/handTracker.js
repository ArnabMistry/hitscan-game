import {
  POINTER_SMOOTHING_ALPHA,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../app/constants.js';
import { lerp, normalize } from '../utils/math.js';

const WRIST_INDEX = 0;
const INDEX_TIP_INDEX = 8;
const MIN_HANDEDNESS_SCORE = 0.7;

function describeCause(cause) {
  if (cause instanceof Error) {
    return cause.message;
  }

  if (typeof cause === 'string') {
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
      return JSON.stringify(cause);
    } catch {
      return Object.prototype.toString.call(cause);
    }
  }

  return String(cause);
}

function mapHandIndex(results, preferredHandedness) {
  const handednesses = results.handednesses;
  if (!handednesses || handednesses.length === 0) {
    return -1;
  }

  const targetLabel = preferredHandedness === 'left' ? 'Left' : 'Right';
  for (let i = 0; i < handednesses.length; i += 1) {
    const entry = handednesses[i];
    if (!entry || entry.length === 0) {
      continue;
    }
    if (entry[0].categoryName === targetLabel) {
      return i;
    }
  }

  return -1;
}

function smoothLandmarks(rawLandmarks, previousLandmarks, alpha) {
  const next = new Array(rawLandmarks.length);

  for (let i = 0; i < rawLandmarks.length; i += 1) {
    const raw = rawLandmarks[i];
    const previous = previousLandmarks[i] ?? raw;
    next[i] = {
      x: lerp(previous.x, raw.x, alpha),
      y: lerp(previous.y, raw.y, alpha),
      z: lerp(previous.z, raw.z, alpha),
    };
  }

  return next;
}

function createEmptyState() {
  return {
    hasHand: false,
    rawLandmarks: null,
    landmarks: null,
    pointer: { x: WORLD_WIDTH * 0.5, y: WORLD_HEIGHT * 0.5, visible: false },
    direction: { x: 0, y: -1, mag: 0 },
    handedness: null,
  };
}

async function setupCamera(videoEl) {
  if (!window.isSecureContext) {
    throw new Error('Camera access requires a secure context (https:// or localhost).');
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Camera API unavailable in this browser.');
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    videoEl.srcObject = stream;
    videoEl.setAttribute('playsinline', 'true');
    videoEl.muted = true;

    await videoEl.play();
    return stream;
  } catch (cause) {
    throw new Error(`Camera initialization failed: ${describeCause(cause)}`);
  }
}

async function setupLandmarker() {
  const baseUrl = import.meta.env.BASE_URL ?? '/';
  const localWasmBase = `${baseUrl}mediapipe`.replace(/\/{2,}/g, '/');
  const wasmBaseCandidates = [
    localWasmBase,
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm',
  ];

  try {
    const vision = await import('@mediapipe/tasks-vision');
    let lastError = null;

    for (let i = 0; i < wasmBaseCandidates.length; i += 1) {
      const wasmBase = wasmBaseCandidates[i];
      try {
        const filesetResolver = await vision.FilesetResolver.forVisionTasks(wasmBase);
        return await vision.HandLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          },
          numHands: 2,
          runningMode: 'VIDEO',
          minHandDetectionConfidence: 0.65,
          minHandPresenceConfidence: 0.65,
          minTrackingConfidence: 0.6,
        });
      } catch (cause) {
        lastError = cause;
      }
    }

    throw lastError ?? new Error('No MediaPipe WASM source succeeded.');
  } catch (cause) {
    throw new Error(
      `MediaPipe initialization failed: ${describeCause(cause)} (attempted ${wasmBaseCandidates.join(', ')})`,
    );
  }
}

export function createHandTracker({
  video,
  width = WORLD_WIDTH,
  height = WORLD_HEIGHT,
  handedness = 'right',
  smoothing = POINTER_SMOOTHING_ALPHA,
} = {}) {
  if (!video) {
    throw new Error('createHandTracker requires a video element');
  }

  let preferredHandedness = handedness;
  let active = false;
  let rafId = 0;
  let streamRef = null;
  let landmarker = null;
  let previousSmoothedLandmarks = [];
  let pointerInitialized = false;
  let previousPointerX = width * 0.5;
  let previousPointerY = height * 0.5;
  let debugFrameCounter = 0;

  const state = createEmptyState();

  function updateStateWithDetection(results) {
    const index = mapHandIndex(results, preferredHandedness);

    if (index < 0) {
      state.hasHand = false;
      state.pointer.visible = false;
      state.rawLandmarks = null;
      state.landmarks = null;
      state.handedness = null;
      previousSmoothedLandmarks = [];
      pointerInitialized = false;
      return;
    }

    const handednessScore = results.handednesses?.[index]?.[0]?.score ?? 0;
    if (handednessScore < MIN_HANDEDNESS_SCORE) {
      state.hasHand = false;
      state.pointer.visible = false;
      state.rawLandmarks = null;
      state.landmarks = null;
      state.handedness = null;
      previousSmoothedLandmarks = [];
      pointerInitialized = false;
      return;
    }

    const rawLandmarks = results.landmarks[index];
    if (!rawLandmarks || rawLandmarks.length < 21) {
      state.hasHand = false;
      state.pointer.visible = false;
      return;
    }

    const smooth = smoothLandmarks(rawLandmarks, previousSmoothedLandmarks, smoothing);
    previousSmoothedLandmarks = smooth;

    const wrist = smooth[WRIST_INDEX];
    const indexTip = smooth[INDEX_TIP_INDEX];
    const rawIndexTip = rawLandmarks[INDEX_TIP_INDEX];

    const rawPointerX = (1 - rawIndexTip.x) * width;
    const rawPointerY = rawIndexTip.y * height;
    const pointerX = pointerInitialized
      ? previousPointerX + (rawPointerX - previousPointerX) * smoothing
      : rawPointerX;
    const pointerY = pointerInitialized
      ? previousPointerY + (rawPointerY - previousPointerY) * smoothing
      : rawPointerY;
    pointerInitialized = true;
    previousPointerX = pointerX;
    previousPointerY = pointerY;

    const direction = normalize(indexTip.x - wrist.x, indexTip.y - wrist.y);

    state.hasHand = true;
    state.rawLandmarks = rawLandmarks;
    state.landmarks = smooth;
    state.pointer.x = pointerX;
    state.pointer.y = pointerY;
    state.pointer.visible = true;
    state.direction = direction;
    state.handedness = preferredHandedness;

    if (import.meta.env.DEV) {
      debugFrameCounter += 1;
      if (debugFrameCounter % 30 === 0) {
        console.debug('[handTracker]', {
          indexTipX: rawIndexTip.x,
          indexTipY: rawIndexTip.y,
          smoothedPointerX: pointerX,
          smoothedPointerY: pointerY,
        });
      }
    }
  }

  function detectFrame() {
    if (!active || !landmarker) {
      return;
    }

    const results = landmarker.detectForVideo(video, performance.now());
    updateStateWithDetection(results);
    rafId = requestAnimationFrame(detectFrame);
  }

  async function start() {
    if (active) {
      return;
    }
    active = true;

    try {
      const [stream, model] = await Promise.all([setupCamera(video), setupLandmarker()]);
      streamRef = stream;
      landmarker = model;
      detectFrame();
    } catch (cause) {
      active = false;

      if (streamRef) {
        const tracks = streamRef.getTracks();
        for (let i = 0; i < tracks.length; i += 1) {
          tracks[i].stop();
        }
        streamRef = null;
      }

      if (landmarker) {
        landmarker.close();
        landmarker = null;
      }

      throw new Error(`Hand tracker start failed: ${describeCause(cause)}`);
    }
  }

  function stop() {
    active = false;

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }

    if (landmarker) {
      landmarker.close();
      landmarker = null;
    }

    if (streamRef) {
      const tracks = streamRef.getTracks();
      for (let i = 0; i < tracks.length; i += 1) {
        tracks[i].stop();
      }
      streamRef = null;
    }

    if (video.srcObject) {
      video.srcObject = null;
    }

    const empty = createEmptyState();
    Object.assign(state, empty);
    previousSmoothedLandmarks = [];
    pointerInitialized = false;
    previousPointerX = width * 0.5;
    previousPointerY = height * 0.5;
    debugFrameCounter = 0;
  }

  function getState() {
    return state;
  }

  function setHandedness(next) {
    preferredHandedness = next;
  }

  return {
    start,
    stop,
    getState,
    setHandedness,
  };
}
