import { describe, expect, it } from "vitest";

import { parseMoveNotation } from "../../../src/lib/cube";

import { getNextArrowMove } from "./getNextArrowMove";

describe("getNextArrowMove", () => {
  it.each(["R", "U", "F"] as const)(
    "%s maps no pending move to base on clockwise",
    (face) => {
      expect(getNextArrowMove(face, "clockwise", null).notation).toBe(face);
    },
  );

  it.each(["R", "U", "F"] as const)(
    "%s maps no pending move to prime on counterclockwise",
    (face) => {
      expect(getNextArrowMove(face, "counterclockwise", null).notation).toBe(
        `${face}'`,
      );
    },
  );

  it.each(["R", "U", "F"] as const)(
    "%s upgrades base to double on clockwise",
    (face) => {
      expect(
        getNextArrowMove(face, "clockwise", parseMoveNotation(face)).notation,
      ).toBe(`${face}2`);
    },
  );

  it.each(["R", "U", "F"] as const)(
    "%s upgrades prime to double on counterclockwise",
    (face) => {
      expect(
        getNextArrowMove(
          face,
          "counterclockwise",
          parseMoveNotation(`${face}'`),
        ).notation,
      ).toBe(`${face}2`);
    },
  );

  it.each(["R", "U", "F"] as const)(
    "%s maps double to base on clockwise",
    (face) => {
      expect(
        getNextArrowMove(
          face,
          "clockwise",
          parseMoveNotation(`${face}2`),
        ).notation,
      ).toBe(face);
    },
  );

  it.each(["R", "U", "F"] as const)(
    "%s maps double to prime on counterclockwise",
    (face) => {
      expect(
        getNextArrowMove(
          face,
          "counterclockwise",
          parseMoveNotation(`${face}2`),
        ).notation,
      ).toBe(`${face}'`);
    },
  );

  it.each(["R", "U", "F"] as const)(
    "%s replaces base with prime on counterclockwise",
    (face) => {
      expect(
        getNextArrowMove(
          face,
          "counterclockwise",
          parseMoveNotation(face),
        ).notation,
      ).toBe(`${face}'`);
    },
  );

  it.each(["R", "U", "F"] as const)(
    "%s replaces prime with base on clockwise",
    (face) => {
      expect(
        getNextArrowMove(
          face,
          "clockwise",
          parseMoveNotation(`${face}'`),
        ).notation,
      ).toBe(face);
    },
  );
});
