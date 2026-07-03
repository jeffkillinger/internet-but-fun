import {
  parseMoveNotation,
  type Face,
  type Move,
} from "../../../src/lib/cube";

import type { FaceNormal } from "./getSelectedFace";

export type ArrowDirection = "clockwise" | "counterclockwise";

export type ArrowAffordance = Readonly<{
  direction: ArrowDirection;
  position: FaceNormal;
  travelDirection: FaceNormal;
  move: Move;
}>;

type ArrowDefinition = Readonly<{
  clockwisePosition: FaceNormal;
  counterclockwisePosition: FaceNormal;
  travelDirection: FaceNormal;
}>;

/**
 * World-space edge-displacement convention:
 *
 * Each clockwise arrow sits beyond the face's visual top edge and follows
 * that edge toward visual right. Each counterclockwise arrow sits beyond the
 * opposite edge, where counterclockwise sticker travel is also visual right.
 * The positions are outside the cube's +/-1.47 rendered extent.
 */
const ARROW_DEFINITIONS: Readonly<Record<Face, ArrowDefinition>> = {
  U: {
    clockwisePosition: [0, 1.75, -1.65],
    counterclockwisePosition: [0, 1.75, 1.65],
    travelDirection: [1, 0, 0],
  },
  D: {
    clockwisePosition: [0, -1.75, 1.65],
    counterclockwisePosition: [0, -1.75, -1.65],
    travelDirection: [1, 0, 0],
  },
  L: {
    clockwisePosition: [-1.75, 1.65, 0],
    counterclockwisePosition: [-1.75, -1.65, 0],
    travelDirection: [0, 0, 1],
  },
  R: {
    clockwisePosition: [1.75, 1.65, 0],
    counterclockwisePosition: [1.75, -1.65, 0],
    travelDirection: [0, 0, -1],
  },
  F: {
    clockwisePosition: [0, 1.65, 1.75],
    counterclockwisePosition: [0, -1.65, 1.75],
    travelDirection: [1, 0, 0],
  },
  B: {
    clockwisePosition: [0, 1.65, -1.75],
    counterclockwisePosition: [0, -1.65, -1.75],
    travelDirection: [-1, 0, 0],
  },
};

export function getArrowAffordancesForFace(
  face: Face,
): readonly [ArrowAffordance, ArrowAffordance] {
  const definition = ARROW_DEFINITIONS[face];

  return [
    {
      direction: "clockwise",
      position: definition.clockwisePosition,
      travelDirection: definition.travelDirection,
      move: parseMoveNotation(face),
    },
    {
      direction: "counterclockwise",
      position: definition.counterclockwisePosition,
      travelDirection: definition.travelDirection,
      move: parseMoveNotation(`${face}'`),
    },
  ];
}
