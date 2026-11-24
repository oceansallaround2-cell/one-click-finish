import { describe, expect, it } from "vitest";

import { cameraRelativeDirection, moveFromJoystick, moveFromKeyboard } from "./movement";

describe("player movement inputs", () => {
  it("moves forward and sideways in consistent keyboard directions", () => {
    expect(moveFromKeyboard(new Set(["KeyW"]))).toEqual({ x: 0, y: 1 });
    expect(moveFromKeyboard(new Set(["KeyD"]))).toEqual({ x: 1, y: 0 });
  });

  it("keeps diagonal keyboard and touch movement within normal walking speed", () => {
    const keyboard = moveFromKeyboard(new Set(["KeyW", "KeyD"]));
    const touch = moveFromJoystick(1, 1);
    expect(Math.hypot(keyboard.x, keyboard.y)).toBeCloseTo(1);
    expect(touch).toEqual(keyboard);
  });

  it("rotates forward movement with the camera instead of world axes", () => {
    expect(cameraRelativeDirection({ x: 0, y: 1 }, 0).z).toBe(-1);
    expect(cameraRelativeDirection({ x: 0, y: 1 }, Math.PI / 2).x).toBe(1);
  });
});