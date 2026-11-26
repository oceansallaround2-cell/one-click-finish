import { describe, expect, it } from "vitest";
import { canJoinRoom, normalizeRoomCode, parseRoomPlayer } from "./room";

describe("two-player room rules", () => {
  it("allows a room to fill its first two seats, but never a third", () => {
    expect(canJoinRoom(0)).toBe(true);
    expect(canJoinRoom(1)).toBe(true);
    expect(canJoinRoom(2)).toBe(false);
    expect(canJoinRoom(3)).toBe(false);
  });

  it("rejects invalid room occupancy counts", () => {
    expect(canJoinRoom(-1)).toBe(false);
    expect(canJoinRoom(1.5)).toBe(false);
  });

  it("normalizes a four-letter invitation code", () => {
    expect(normalizeRoomCode(" ab-cd ")).toBe("ABCD");
    expect(normalizeRoomCode("ABC")).toBeNull();
  });

  it("accepts finite player state and rejects malformed or unsafe packets", () => {
    const player = parseRoomPlayer({
      id: "peer-1",
      name: "Mira",
      character: "mira",
      position: [1, 0.9, 3],
      rotationY: 0.4,
      wantedLevel: 2,
      activity: "wanted",
      missionIndex: 1,
      activeOutfitId: "sunset",
      activeWeaponId: "fists",
    });

    expect(player?.position).toEqual([1, 0.9, 3]);
    expect(player?.wantedLevel).toBe(2);
    expect(parseRoomPlayer({ ...player, position: [Number.NaN, 0, 0] })).toBeNull();
    expect(parseRoomPlayer({ ...player, wantedLevel: 6 })).toBeNull();
  });
});