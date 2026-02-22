import { normalize } from '../utils/math.js';
import { FLICK_DELTA_Y_THRESHOLD, SHOOT_COOLDOWN_MS } from '../app/constants.js';

const HAND_LANDMARKS = {
  WRIST: 0,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_TIP: 8,
  MIDDLE_PIP: 10,
  MIDDLE_TIP: 12,
  RING_PIP: 14,
  RING_TIP: 16,
  PINKY_PIP: 18,
  PINKY_TIP: 20,
};

function isFingerExtended(tip, pip, mcp) {
  return tip.y < pip.y && pip.y < mcp.y;
}

function isFingerCurled(tip, pip) {
  return tip.y > pip.y;
}

function getGunPose(landmarks) {
  if (!landmarks || landmarks.length < 21) {
    return false;
  }

  const indexTip = landmarks[HAND_LANDMARKS.INDEX_TIP];
  const indexPip = landmarks[HAND_LANDMARKS.INDEX_PIP];
  const indexMcp = landmarks[HAND_LANDMARKS.INDEX_MCP];
  const middleTip = landmarks[HAND_LANDMARKS.MIDDLE_TIP];
  const middlePip = landmarks[HAND_LANDMARKS.MIDDLE_PIP];
  const ringTip = landmarks[HAND_LANDMARKS.RING_TIP];
  const ringPip = landmarks[HAND_LANDMARKS.RING_PIP];
  const pinkyTip = landmarks[HAND_LANDMARKS.PINKY_TIP];
  const pinkyPip = landmarks[HAND_LANDMARKS.PINKY_PIP];

  if (!indexTip || !indexPip || !indexMcp || !middleTip || !middlePip || !ringTip || !ringPip || !pinkyTip || !pinkyPip) {
    return false;
  }

  return (
    isFingerExtended(indexTip, indexPip, indexMcp) &&
    isFingerCurled(middleTip, middlePip) &&
    isFingerCurled(ringTip, ringPip) &&
    isFingerCurled(pinkyTip, pinkyPip)
  );
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
        direction: { x: 0, y: -1, mag: 0 },
        reason: 'no-hand',
      };
    }

    const landmarks = currentFrame.landmarks;
    const gunPose = getGunPose(landmarks);

    const prevIndexTip = previousFrame?.landmarks?.[HAND_LANDMARKS.INDEX_TIP];
    const currIndexTip = landmarks[HAND_LANDMARKS.INDEX_TIP];
    const currWrist = landmarks[HAND_LANDMARKS.WRIST];

    const deltaY = prevIndexTip && currIndexTip ? prevIndexTip.y - currIndexTip.y : 0;

    const vectorX = (currIndexTip?.x ?? 0) - (currWrist?.x ?? 0);
    const vectorY = (currIndexTip?.y ?? 0) - (currWrist?.y ?? 0);
    const direction = normalize(vectorX, vectorY);

    if (!gunPose) {
      return { gunPose, deltaY, shoot: false, direction, reason: 'pose-invalid' };
    }

    if (deltaY <= flickThreshold) {
      return { gunPose, deltaY, shoot: false, direction, reason: 'flick-too-slow' };
    }

    if (nowMs - lastShootTs < cooldownMs) {
      return { gunPose, deltaY, shoot: false, direction, reason: 'cooldown' };
    }

    lastShootTs = nowMs;
    return { gunPose, deltaY, shoot: true, direction, reason: 'shoot' };
  }

  return { evaluate };
}
