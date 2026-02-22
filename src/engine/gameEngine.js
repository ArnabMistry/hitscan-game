import {
  BASE_TARGET_COUNT,
  COLOR_ACCENT,
  COLOR_FG,
  FRAME_DT_MAX,
  FRAME_DT_MIN,
  MAX_TARGET_COUNT,
  POINTER_SIZE,
  TARGET_BASE_SPEED,
  TARGET_RADIUS,
  TARGET_SPEED_STEP,
  TARGET_SPAWN_MARGIN,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../app/constants.js';
import { clamp, distance, normalize } from '../utils/math.js';

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function createEmitter() {
  const handlers = new Map();

  function on(eventName, handler) {
    const list = handlers.get(eventName) ?? [];
    list.push(handler);
    handlers.set(eventName, list);
    return () => {
      const next = handlers.get(eventName) ?? [];
      handlers.set(
        eventName,
        next.filter((item) => item !== handler),
      );
    };
  }

  function emit(eventName, payload) {
    const list = handlers.get(eventName);
    if (!list || list.length === 0) {
      return;
    }
    for (let i = 0; i < list.length; i += 1) {
      list[i](payload);
    }
  }

  return { on, emit };
}

export function createGameEngine(config = {}) {
  const width = config.width ?? WORLD_WIDTH;
  const height = config.height ?? WORLD_HEIGHT;

  const emitter = createEmitter();

  let running = false;
  let score = 0;
  let wave = 1;

  let targetId = 1;
  const targets = [];

  const pointer = {
    x: width * 0.5,
    y: height * 0.5,
    visible: false,
    locked: false,
    size: POINTER_SIZE,
    color: COLOR_FG,
    flashUntil: 0,
  };

  function spawnWave(nextWave) {
    targets.length = 0;
    const count = Math.min(BASE_TARGET_COUNT + (nextWave - 1), MAX_TARGET_COUNT);
    const speed = TARGET_BASE_SPEED + (nextWave - 1) * TARGET_SPEED_STEP;

    for (let i = 0; i < count; i += 1) {
      const angle = randomRange(0, Math.PI * 2);
      const direction = normalize(Math.cos(angle), Math.sin(angle));
      targets.push({
        id: targetId,
        x: randomRange(TARGET_SPAWN_MARGIN, width - TARGET_SPAWN_MARGIN),
        y: randomRange(TARGET_SPAWN_MARGIN, height - TARGET_SPAWN_MARGIN),
        vx: direction.x * randomRange(speed * 0.85, speed * 1.15),
        vy: direction.y * randomRange(speed * 0.85, speed * 1.15),
        radius: TARGET_RADIUS,
        color: COLOR_ACCENT,
      });
      targetId += 1;
    }
  }

  function respawnTarget(target) {
    const speed = Math.hypot(target.vx, target.vy) || TARGET_BASE_SPEED;
    const angle = randomRange(0, Math.PI * 2);
    const direction = normalize(Math.cos(angle), Math.sin(angle));
    target.x = randomRange(TARGET_SPAWN_MARGIN, width - TARGET_SPAWN_MARGIN);
    target.y = randomRange(TARGET_SPAWN_MARGIN, height - TARGET_SPAWN_MARGIN);
    target.vx = direction.x * speed;
    target.vy = direction.y * speed;
  }

  function fireHitscan(pointerX, pointerY) {
    emitter.emit('shoot', { x: pointerX, y: pointerY });

    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      if (distance(pointerX, pointerY, target.x, target.y) >= target.radius) {
        continue;
      }

      score += 1;
      emitter.emit('hit', { score, targetId: target.id });
      emitter.emit('score', score);
      respawnTarget(target);
      return;
    }

    emitter.emit('miss', { x: pointerX, y: pointerY });
  }

  function detectTargetLock(pointerX, pointerY) {
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      if (distance(pointerX, pointerY, target.x, target.y) < target.radius) {
        return true;
      }
    }
    return false;
  }

  function maybeAdvanceWave() {
    if (targets.length !== 0) {
      return;
    }
    wave += 1;
    spawnWave(wave);
    emitter.emit('waveChange', wave);
  }

  function updateTargets(dt) {
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      target.x += target.vx * dt;
      target.y += target.vy * dt;

      if (target.x - target.radius <= 0 || target.x + target.radius >= width) {
        target.vx *= -1;
        target.x = clamp(target.x, target.radius, width - target.radius);
      }

      if (target.y - target.radius <= 0 || target.y + target.radius >= height) {
        target.vy *= -1;
        target.y = clamp(target.y, target.radius, height - target.radius);
      }
    }
  }

  function update(dt, inputSnapshot, gestureSnapshot, nowMs) {
    if (!running) {
      return;
    }

    const safeDt = clamp(dt, FRAME_DT_MIN, FRAME_DT_MAX);

    if (inputSnapshot?.pointer?.visible) {
      pointer.visible = true;
      pointer.x = inputSnapshot.pointer.x;
      pointer.y = inputSnapshot.pointer.y;
      pointer.locked = detectTargetLock(pointer.x, pointer.y);
    } else {
      pointer.visible = false;
      pointer.locked = false;
    }

    if (gestureSnapshot?.shoot && pointer.visible) {
      fireHitscan(pointer.x, pointer.y);
      pointer.flashUntil = nowMs + 100;
    }

    updateTargets(safeDt);
    maybeAdvanceWave();
  }

  function getSnapshot() {
    return {
      width,
      height,
      score,
      wave,
      targets,
      projectiles: [],
      pointer,
      colors: {
        fg: COLOR_FG,
        accent: COLOR_ACCENT,
      },
    };
  }

  function start() {
    if (running) {
      return;
    }
    running = true;
    if (targets.length === 0) {
      spawnWave(wave);
    }
  }

  function pause() {
    running = false;
  }

  function reset() {
    score = 0;
    wave = 1;
    targets.length = 0;
    spawnWave(wave);
    emitter.emit('score', score);
    emitter.emit('waveChange', wave);
  }

  return {
    start,
    pause,
    reset,
    update,
    getSnapshot,
    on: emitter.on,
  };
}
