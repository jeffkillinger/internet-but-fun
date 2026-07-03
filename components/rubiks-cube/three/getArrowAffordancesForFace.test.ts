import { describe, expect, it } from "vitest";

import { FACES } from "../../../src/lib/cube";

import { getArrowAffordancesForFace } from "./getArrowAffordancesForFace";

describe("getArrowAffordancesForFace", () => {
  it.each(FACES)("%s returns clockwise and counterclockwise arrows", (face) => {
    const affordances = getArrowAffordancesForFace(face);

    expect(affordances.map(({ direction }) => direction)).toEqual([
      "clockwise",
      "counterclockwise",
    ]);
  });

  it.each(FACES)("%s maps clockwise to base and counterclockwise to prime", (face) => {
    const [clockwise, counterclockwise] =
      getArrowAffordancesForFace(face);

    expect(clockwise.move.notation).toBe(face);
    expect(counterclockwise.move.notation).toBe(`${face}'`);
  });

  it.each(FACES)("%s does not return duplicate moves", (face) => {
    const moves = getArrowAffordancesForFace(face).map(
      ({ move }) => move.notation,
    );

    expect(new Set(moves)).toHaveLength(2);
  });

  it.each(FACES)(
    "%s places clockwise and counterclockwise arcs on opposite perimeters",
    (face) => {
      const [clockwise, counterclockwise] =
        getArrowAffordancesForFace(face);
      const clockwiseMidpoint =
        (clockwise.startAngle + clockwise.endAngle) / 2;
      const counterclockwiseMidpoint =
        (counterclockwise.startAngle + counterclockwise.endAngle) / 2;

      expect(Math.sin(clockwiseMidpoint)).toBeGreaterThan(0);
      expect(Math.sin(counterclockwiseMidpoint)).toBeLessThan(0);
    },
  );

  it.each(FACES)(
    "%s uses opposite angular directions for clockwise and counterclockwise",
    (face) => {
      const [clockwise, counterclockwise] =
        getArrowAffordancesForFace(face);

      expect(clockwise.endAngle).toBeLessThan(clockwise.startAngle);
      expect(counterclockwise.endAngle).toBeGreaterThan(
        counterclockwise.startAngle,
      );
    },
  );
});
