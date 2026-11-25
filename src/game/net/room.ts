export const ROOM_CODE_LENGTH = 4;
export const MAX_ROOM_PLAYERS = 2;

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export type CharacterId = "mira" | "leo";

export type RoomPlayerState = {
  id: string;
  name: string;
  character: CharacterId;
  position: [number, number, number];
  rotationY: number;
};

export type LocalPlayerState = Omit<RoomPlayerState, "id" | "name">;

export function createRoomCode(random: () => number = Math.random): string {
  return Array.from({ length: ROOM_CODE_LENGTH }, () => {
    const index = Math.floor(random() * ROOM_CODE_ALPHABET.length);
    return ROOM_CODE_ALPHABET[index] ?? ROOM_CODE_ALPHABET[0] ?? "A";
  }).join("");
}

export function normalizeRoomCode(value: string): string | null {
  const code = value.trim().toUpperCase().replace(/[\s-]/g, "");
  return /^[A-Z]{4}$/.test(code) ? code : null;
}

export function canJoinRoom(currentPlayerCount: number): boolean {
  return Number.isInteger(currentPlayerCount) && currentPlayerCount >= 0 && currentPlayerCount < MAX_ROOM_PLAYERS;
}

export function parseRoomPlayer(value: unknown): RoomPlayerState | null {
  if (value === null || typeof value !== "object") return null;

  const packet = value as Record<string, unknown>;
  const id = packet["id"];
  const name = packet["name"];
  const character = packet["character"];
  const x = packet["x"];
  const y = packet["y"];
  const z = packet["z"];
  const rotationY = packet["ry"];

  if (
    typeof id !== "string" ||
    id.length === 0 ||
    (character !== "mira" && character !== "leo") ||
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof z !== "number" ||
    typeof rotationY !== "number" ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(z) ||
    !Number.isFinite(rotationY) ||
    Math.abs(x) > 1000 ||
    Math.abs(y) > 100 ||
    Math.abs(z) > 1000
  ) {
    return null;
  }

  return {
    id,
    name: typeof name === "string" ? name.slice(0, 32) : character === "mira" ? "Mira" : "Leo",
    character,
    position: [x, y, z],
    rotationY,
  };
}