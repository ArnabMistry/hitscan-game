import { distance, normalize } from '../utils/math.js';
import { FLICK_DELTA_Y_THRESHOLD, SHOOT_COOLDOWN_MS } from '../app/constants.js';

const HAND_LANDMARKS = {
  WRIST: 0,
  INDEX_PIP: 6,
  INDEX_TIP: 8,
  MIDDLE_PIP: 10,
  MIDDLE_TIP: 12,
  RING_PIP: 14,
  RING_TIP: 16,
  PINKY_PIP: 18,
  PINKY_TIP: 20,
};

function getFingerExtensionState(landmarks) {
  if (!landmarks || landmarks.length < 21) {
    return {
      indexExtended: false,
      middleExtended: false,
      ringExtended: false,
      pinkyExtended: false,
    };
  }

  const wrist = landmarks[HAND_LANDMARKS.WRIST];
  const indexTip = landmarks[HAND_LANDMARKS.INDEX_TIP];
  const indexPip = landmarks[HAND_LANDMARKS.INDEX_PIP];
  const middleTip = landmarks[HAND_LANDMARKS.MIDDLE_TIP];
  const middlePip = landmarks[HAND_LANDMARKS.MIDDLE_PIP];
  const ringTip = landmarks[HAND_LANDMARKS.RING_TIP];
  const ringPip = landmarks[HAND_LANDMARKS.RING_PIP];
  const pinkyTip = landmarks[HAND_LANDMARKS.PINKY_TIP];
  const pinkyPip = landmarks[HAND_LANDMARKS.PINKY_PIP];

  const indexExtended =
    distance(wrist.x, wrist.y, indexTip.x, indexTip.y) > distance(wrist.x, wrist.y, indexPip.x, indexPip.y);
  const middleExtended =
    distance(wrist.x, wrist.y, middleTip.x, middleTip.y) > distance(wrist.x, wrist.y, middlePip.x, middlePip.y);
  const ringExtended =
    distance(wrist.x, wrist.y, ringTip.x, ringTip.y) > distance(wrist.x, wrist.y, ringPip.x, ringPip.y);
  const pinkyExtended =
    distance(wrist.x, wrist.y, pinkyTip.x, pinkyTip.y) > distance(wrist.x, wrist.y, pinkyPip.x, pinkyPip.y);

  return {
    indexExtended,
    middleExtended,
    ringExtended,
    pinkyExtended,
  };
}

export function createGestureDetector({
  thresholds = {
    flickDeltaY: FLICK_DELTA_Y_THRESHOLD,
    cooldownMs: SHOOT_COOLDOWN_MS,
  },
} = {}) {
  const flickThreshold = thresholds.flickDeltaY ?? FLICK_DELTA_Y_THRESHOLD;
  const cooldownMs = thresholds.cooldownMs ?? SHOOT_COOLDOWN_MS;
  let lastShootTs = 0;

  function evaluate(previousFrame, currentFrame, nowMs) {
    if (!currentFrame || !currentFrame.hasHand) {
      return {
        gunPose: false,
        deltaY: 0,
        shoot: false,
        indexExtended: false,
        middleExtended: false,
        ringExtended: false,
        pinkyExtended: false,
        direction: { x: 0, y: -1, mag: 0 },
        reason: 'no-hand',
      };
    }

    const landmarks = currentFrame.landmarks;
    const fingerState = getFingerExtensionState(landmarks);
    const gunPose =
      fingerState.indexExtended &&
      fingerState.middleExtended &&
      !fingerState.ringExtended &&
      !fingerState.pinkyExtended;

    const prevIndexTip = previousFrame?.landmarks?.[HAND_LANDMARKS.INDEX_TIP];
    const currIndexTip = landmarks[HAND_LANDMARKS.INDEX_TIP];
    const currWrist = landmarks[HAND_LANDMARKS.WRIST];

    const deltaY = prevIndexTip && currIndexTip ? prevIndexTip.y - currIndexTip.y : 0;

    const vectorX = (currIndexTip?.x ?? 0) - (currWrist?.x ?? 0);
    const vectorY = (currIndexTip?.y ?? 0) - (currWrist?.y ?? 0);
    const direction = normalize(vectorX, vectorY);

    if (!gunPose) {
      return { ...fingerState, gunPose, deltaY, shoot: false, direction, reason: 'pose-invalid' };
    }

    if (deltaY <= flickThreshold) {
      return { ...fingerState, gunPose, deltaY, shoot: false, direction, reason: 'flick-too-slow' };
    }

    if (nowMs - lastShootTs < cooldownMs) {
      return { ...fingerState, gunPose, deltaY, shoot: false, direction, reason: 'cooldown' };
    }

    lastShootTs = nowMs;
    return { ...fingerState, gunPose, deltaY, shoot: true, direction, reason: 'shoot' };
  }

  return { evaluate };
}
