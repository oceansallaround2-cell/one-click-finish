export const ROOM_CODE_LENGTH = 4;
export const MAX_ROOM_PLAYERS = 2;

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export type CharacterId = "mira" | "leo";
export type PlayerActivity = "walking" | "wanted" | "shopping" | "mission";

export type RoomPlayerState = {
  id: string;
  name: string;
  character: CharacterId;
  position: [number, number, number];
  rotationY: number;
  wantedLevel: number;
  activity: PlayerActivity;
  missionIndex: number;
  activeOutfitId: string;
  activeWeaponId: string;
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
  const rawPosition = packet["position"];
  const position = Array.isArray(rawPosition)
    ? rawPosition
    : [packet["x"], packet["y"], packet["z"]];
  const rotationY = packet["rotationY"] ?? packet["ry"];
  const wantedLevel = packet["wantedLevel"] ?? 0;
  const missionIndex = packet["missionIndex"] ?? 0;
  const activity = packet["activity"] ?? "walking";
  const activeOutfitId = packet["activeOutfitId"] ?? "sunset";
  const activeWeaponId = packet["activeWeaponId"] ?? "fists";

  if (
    typeof id !== "string" ||
    id.length === 0 ||
    id.length > 128 ||
    (character !== "mira" && character !== "leo") ||
    position.length !== 3 ||
    typeof position[0] !== "number" ||
    typeof position[1] !== "number" ||
    typeof position[2] !== "number" ||
    typeof rotationY !== "number" ||
    !Number.isFinite(position[0]) ||
    !Number.isFinite(position[1]) ||
    !Number.isFinite(position[2]) ||
    !Number.isFinite(rotationY) ||
    Math.abs(position[0]) > 1000 ||
    Math.abs(position[1]) > 100 ||
    Math.abs(position[2]) > 1000 ||
    typeof wantedLevel !== "number" ||
    !Number.isInteger(wantedLevel) ||
    wantedLevel < 0 ||
    wantedLevel > 5 ||
    typeof missionIndex !== "number" ||
    !Number.isInteger(missionIndex) ||
    missionIndex < 0 ||
    missionIndex > 100000 ||
    (activity !== "walking" && activity !== "wanted" && activity !== "shopping" && activity !== "mission") ||
    typeof activeOutfitId !== "string" ||
    activeOutfitId.length > 64 ||
    typeof activeWeaponId !== "string" ||
    activeWeaponId.length > 64
  ) {
    return null;
  }

  return {
    id,
    name: typeof name === "string" ? name.slice(0, 32) : character === "mira" ? "Mira" : "Leo",
    character,
    position: [position[0], position[1], position[2]],
    rotationY,
    wantedLevel,
    activity,
    missionIndex,
    activeOutfitId,
    activeWeaponId,
  };
}