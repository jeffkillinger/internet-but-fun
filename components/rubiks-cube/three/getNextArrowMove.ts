import {
  parseMoveNotation,
  type Face,
  type Move,
} from "../../../src/lib/cube";

import type { ArrowDirection } from "./getArrowAffordancesForFace";

export function getNextArrowMove(
  face: Face,
  direction: ArrowDirection,
  pendingMove: Move | null,
): Move {
  if (
    pendingMove?.face === face &&
    ((direction === "clockwise" && pendingMove.amount === 1) ||
      (direction === "counterclockwise" && pendingMove.amount === -1))
  ) {
    return parseMoveNotation(`${face}2`);
  }

  if (direction === "clockwise") {
    return parseMoveNotation(face);
  }

  return parseMoveNotation(`${face}'`);
}
