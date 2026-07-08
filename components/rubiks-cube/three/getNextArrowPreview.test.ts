import { describe, expect, it } from "vitest";

import { parseMoveNotation } from "../../../src/lib/cube";

import { getNextArrowPreview } from "./getNextArrowPreview";

describe("getNextArrowPreview", () => {
  it.each(["R", "U", "F"] as const)(
    "%s maps clockwise with no pending move to base plus clockwise intent",
    (face) => {
      const preview = getNextArrowPreview(face, "clockwise", null);

      expect(preview.move.notation).toBe(face);
      expect(preview.animationIntent).toEqual({
        direction: "clockwise",
        moveNotation: face,
      });
    },
  );

  it.each(["R", "U", "F"] as const)(
    "%s maps clockwise twice to double plus clockwise intent",
    (face) => {
      const preview = getNextArrowPreview(
        face,
        "clockwise",
        parseMoveNotation(face),
      );

      expect(preview.move.notation).toBe(`${face}2`);
      expect(preview.animationIntent).toEqual({
        direction: "clockwise",
        moveNotation: `${face}2`,
      });
    },
  );

  it.each(["R", "U", "F"] as const)(
    "%s maps counterclockwise with no pending move to prime plus counterclockwise intent",
    (face) => {
      const preview = getNextArrowPreview(face, "counterclockwise", null);

      expect(preview.move.notation).toBe(`${face}'`);
      expect(preview.animationIntent).toEqual({
        direction: "counterclockwise",
        moveNotation: `${face}'`,
      });
    },
  );

  it.each(["R", "U", "F"] as const)(
    "%s maps counterclockwise twice to double plus counterclockwise intent",
    (face) => {
      const preview = getNextArrowPreview(
        face,
        "counterclockwise",
        parseMoveNotation(`${face}'`),
      );

      expect(preview.move.notation).toBe(`${face}2`);
      expect(preview.animationIntent).toEqual({
        direction: "counterclockwise",
        moveNotation: `${face}2`,
      });
    },
  );

  it.each(["R", "U", "F"] as const)(
    "%s updates intent on base to prime replacement",
    (face) => {
      const preview = getNextArrowPreview(
        face,
        "counterclockwise",
        parseMoveNotation(face),
      );

      expect(preview.move.notation).toBe(`${face}'`);
      expect(preview.animationIntent).toEqual({
        direction: "counterclockwise",
        moveNotation: `${face}'`,
      });
    },
  );

  it.each(["R", "U", "F"] as const)(
    "%s updates intent on prime to base replacement",
    (face) => {
      const preview = getNextArrowPreview(
        face,
        "clockwise",
        parseMoveNotation(`${face}'`),
      );

      expect(preview.move.notation).toBe(face);
      expect(preview.animationIntent).toEqual({
        direction: "clockwise",
        moveNotation: face,
      });
    },
  );

  it.each(["R", "U", "F"] as const)(
    "%s maps double to base on clockwise",
    (face) => {
      const preview = getNextArrowPreview(
        face,
        "clockwise",
        parseMoveNotation(`${face}2`),
      );

      expect(preview.move.notation).toBe(face);
      expect(preview.animationIntent.direction).toBe("clockwise");
    },
  );

  it.each(["R", "U", "F"] as const)(
    "%s maps double to prime on counterclockwise",
    (face) => {
      const preview = getNextArrowPreview(
        face,
        "counterclockwise",
        parseMoveNotation(`${face}2`),
      );

      expect(preview.move.notation).toBe(`${face}'`);
      expect(preview.animationIntent.direction).toBe("counterclockwise");
    },
  );
});
