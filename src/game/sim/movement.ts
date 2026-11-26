export type MoveInput = { x: number; y: number };
export type WorldDirection = { x: number; z: number };

export type MovementInput = {
  moveX: number;
  moveZ: number;
  sprint: boolean;
  jump: boolean;
};

export type MovementStepParams = {
  currentPosition: [number, number, number];
  currentRotationY: number;
  currentSpeed: number;
  velocityY: number;
  input: MovementInput;
  deltaSeconds: number;
};

export type MovementStepResult = {
  nextPosition: [number, number, number];
  nextRotationY: number;
  nextSpeed: number;
  nextVelocityY: number;
  /** Animation amount for the avatar: 0 = idle, 1 = walk, 1.4 = sprint */
  motion: number;
};

export const GROUND_Y = 0.9;
const WALK_SPEED = 4.8;
const SPRINT_SPEED = 6.7;
const JUMP_VELOCITY = 7;
const GRAVITY = 22;

export function clampJoystickInput(input: { x: number; y: number }): { x: number; y: number } {
  const len = Math.hypot(input.x, input.y);
  if (len === 0) return { x: 0, y: 0 };
  const scale = Math.min(1, 1 / len);
  return { x: input.x * scale, y: input.y * scale };
}

export function unitVector(x: number, y: number): MoveInput {
  const length = Math.hypot(x, y);
  if (length === 0) return { x: 0, y: 0 };
  const scale = Math.min(1, 1 / length);
  return { x: x * scale, y: y * scale };
}

export function moveFromKeyboard(keys: ReadonlySet<string>): MoveInput {
  const x = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
  const y = Number(keys.has("KeyW")) - Number(keys.has("KeyS"));
  return unitVector(x, y);
}

export function moveFromJoystick(x: number, y: number): MoveInput {
  return unitVector(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)));
}

export function cameraRelativeDirection(input: MoveInput, cameraYaw: number): WorldDirection {
  const forwardX = Math.sin(cameraYaw);
  const forwardZ = -Math.cos(cameraYaw);
  const rightX = Math.cos(cameraYaw);
  const rightZ = Math.sin(cameraYaw);
  const x = rightX * input.x + forwardX * input.y;
  const z = rightZ * input.x + forwardZ * input.y;
  const length = Math.hypot(x, z);
  if (length === 0) return { x: 0, z: 0 };
  return { x: x / length, z: z / length };
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function shortestAngleDelta(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export function computeMovementStep(params: MovementStepParams): MovementStepResult {
  const dt = Math.max(0, Math.min(finiteOr(params.deltaSeconds, 0), 0.1));
  const pos = params.currentPosition;
  const x = finiteOr(pos?.[0] as number, 0);
  const y = finiteOr(pos?.[1] as number, GROUND_Y);
  const z = finiteOr(pos?.[2] as number, 0);
  const rotationY = finiteOr(params.currentRotationY, 0);
  const speed = finiteOr(params.currentSpeed, 0);
  const velocityY = finiteOr(params.velocityY, 0);

  // The camera sits behind the player looking toward -Z, so camera yaw is 0.
  // moveZ = -1 means "forward" (W / joystick up), which is world -Z.
  const dir = cameraRelativeDirection(
    { x: finiteOr(params.input.moveX, 0), y: -finiteOr(params.input.moveZ, 0) },
    0,
  );
  const wantsMove = dir.x !== 0 || dir.z !== 0;

  const targetSpeed = wantsMove ? (params.input.sprint ? SPRINT_SPEED : WALK_SPEED) : 0;
  const speedEase = 1 - Math.exp(-12 * dt);
  const nextSpeed = speed + (targetSpeed - speed) * speedEase;

  // Avatar faces +Z by default, so turn toward atan2(x, z).
  let nextRotationY = rotationY;
  if (wantsMove) {
    const targetRotation = Math.atan2(dir.x, dir.z);
    nextRotationY = rotationY + shortestAngleDelta(rotationY, targetRotation) * (1 - Math.exp(-14 * dt));
  }

  const nextX = x + dir.x * nextSpeed * dt;
  const nextZ = z + dir.z * nextSpeed * dt;

  const onGround = y <= GROUND_Y + 0.001;
  let nextVelocityY = velocityY;
  if (onGround && params.input.jump) nextVelocityY = JUMP_VELOCITY;
  else if (!onGround) nextVelocityY = velocityY - GRAVITY * dt;
  else nextVelocityY = 0;

  let nextY = y + nextVelocityY * dt;
  if (nextY <= GROUND_Y) {
    nextY = GROUND_Y;
    if (nextVelocityY < 0) nextVelocityY = 0;
  }

  return {
    nextPosition: [nextX, nextY, nextZ],
    nextRotationY,
    nextSpeed,
    nextVelocityY,
    motion: Math.min(1.4, nextSpeed / WALK_SPEED),
  };
}
export function createInitialMovementInput(): MovementInput {
  return {
    moveX: 0,
    moveZ: 0,
    sprint: false,
    jump: false,
  };
}
