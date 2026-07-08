import type { Move, MoveNotation } from "../../../src/lib/cube";

import type { ArrowDirection } from "./getArrowAffordancesForFace";
import { getMoveGeometry, type MoveGeometry } from "./getMoveGeometry";

export type PendingAnimationIntent = Readonly<{
  direction: ArrowDirection;
  moveNotation: MoveNotation;
}>;

export function getMoveGeometryForAnimation(
  move: Move,
  intent: PendingAnimationIntent | null,
): MoveGeometry {
  const geometry = getMoveGeometry(move);

  if (
    move.amount !== 2 ||
    !intent ||
    intent.moveNotation !== move.notation ||
    intent.direction === "clockwise"
  ) {
    return geometry;
  }

  return {
    ...geometry,
    angle: -geometry.angle,
  };
}
