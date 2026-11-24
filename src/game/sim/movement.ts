export type MoveInput = { x: number; y: number };
export type WorldDirection = { x: number; z: number };

function unitVector(x: number, y: number): MoveInput {
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