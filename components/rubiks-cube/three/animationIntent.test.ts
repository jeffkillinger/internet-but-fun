import { describe, expect, it } from "vitest";

import { parseMoveNotation } from "../../../src/lib/cube";

import {
  getMoveGeometryForAnimation,
  type PendingAnimationIntent,
} from "./animationIntent";
import { getMoveGeometry } from "./getMoveGeometry";

describe("getMoveGeometryForAnimation", () => {
  it.each(["R", "U", "F"] as const)(
    "%s2 keeps the default clockwise half-turn for clockwise intent",
    (face) => {
      const move = parseMoveNotation(`${face}2`);
      const intent: PendingAnimationIntent = {
        direction: "clockwise",
        moveNotation: move.notation,
      };

      expect(getMoveGeometryForAnimation(move, intent).angle).toBe(
        getMoveGeometry(move).angle,
      );
    },
  );

  it.each(["R", "U", "F"] as const)(
    "%s2 reverses the half-turn for counterclockwise intent",
    (face) => {
      const move = parseMoveNotation(`${face}2`);
      const intent: PendingAnimationIntent = {
        direction: "counterclockwise",
        moveNotation: move.notation,
      };

      expect(getMoveGeometryForAnimation(move, intent).angle).toBe(
        -getMoveGeometry(move).angle,
      );
    },
  );

  it.each(["R", "U", "F"] as const)(
    "%s2 uses default direction after arrow intent is cleared",
    (face) => {
      const move = parseMoveNotation(`${face}2`);

      expect(getMoveGeometryForAnimation(move, null).angle).toBe(
        getMoveGeometry(move).angle,
      );
    },
  );

  it("ignores stale intent for a different canonical move", () => {
    const move = parseMoveNotation("F2");
    const staleIntent: PendingAnimationIntent = {
      direction: "counterclockwise",
      moveNotation: "R2",
    };

    expect(getMoveGeometryForAnimation(move, staleIntent).angle).toBe(
      getMoveGeometry(move).angle,
    );
  });

  it("does not alter quarter-turn geometry", () => {
    const move = parseMoveNotation("F'");
    const intent: PendingAnimationIntent = {
      direction: "counterclockwise",
      moveNotation: move.notation,
    };

    expect(getMoveGeometryForAnimation(move, intent).angle).toBe(
      getMoveGeometry(move).angle,
    );
  });
});
