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
});
