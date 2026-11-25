export type MoveInput = { x: number; y: number };
export type WorldDirection = { x: number; z: number };

export type MovementInput = {
  forward: number;
  turn: number;
  sprint: boolean;
  jump: boolean;
  interact: boolean;
};

export type MovementVector = {
  nextPosition: [number, number, number];
  rotationY: number;
  facingAngle: number | null;
  isMoving: boolean;
  speed: number;
  currentSpeed: number;
};

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

export function computeMovementStep(
  currentPos: [number, number, number],
  input: MovementInput,
  cameraYaw: number,
  dt: number,
): MovementVector {
  const isMoving = Math.abs(input.forward) > 0.05 || Math.abs(input.turn) > 0.05;
  const baseSpeed = input.sprint ? 9.6 : 4.8;
  const speed = isMoving ? baseSpeed : 0;

  let targetRotation = 0;
  if (isMoving) {
    const inputAngle = Math.atan2(input.turn, input.forward);
    targetRotation = cameraYaw + inputAngle;
  }

  const moveX = Math.sin(targetRotation) * speed * dt;
  const moveZ = Math.cos(targetRotation) * speed * dt;

  return {
    nextPosition: [
      currentPos[0] + (isMoving ? moveX : 0),
      currentPos[1],
      currentPos[2] + (isMoving ? moveZ : 0),
    ],
    rotationY: targetRotation,
    facingAngle: isMoving ? targetRotation : null,
    isMoving,
    speed,
    currentSpeed: speed,
  };
}
