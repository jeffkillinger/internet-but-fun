import {
  parseMoveNotation,
  type Face,
  type Move,
} from "../../../src/lib/cube";

import type { FaceNormal } from "./getSelectedFace";

export type ArrowDirection = "clockwise" | "counterclockwise";

export type ArrowAffordance = Readonly<{
  direction: ArrowDirection;
  normal: FaceNormal;
  right: FaceNormal;
  up: FaceNormal;
  startAngle: number;
  endAngle: number;
  move: Move;
}>;

type FaceArrowDefinition = Readonly<{
  normal: FaceNormal;
  right: FaceNormal;
  up: FaceNormal;
  clockwiseArc: readonly [startAngle: number, endAngle: number];
  counterclockwiseArc: readonly [startAngle: number, endAngle: number];
}>;

const degrees = (value: number) => (value * Math.PI) / 180;

/**
 * Face-local arc convention, expressed in world coordinates for every face:
 *
 * - `right` and `up` are how the face appears when viewed straight-on.
 * - CW occupies the upper perimeter and runs 150° -> 30°.
 * - CCW occupies the lower perimeter and runs 210° -> 330°.
 *
 * Decreasing angle is clockwise; increasing angle is counterclockwise. Thus
 * each arrowhead tangent matches the visible sticker travel produced by the
 * corresponding base or prime move.
 */
const FACE_ARROW_DEFINITIONS: Readonly<Record<Face, FaceArrowDefinition>> = {
  U: {
    normal: [0, 1, 0],
    right: [1, 0, 0],
    up: [0, 0, -1],
    clockwiseArc: [degrees(150), degrees(30)],
    counterclockwiseArc: [degrees(210), degrees(330)],
  },
  D: {
    normal: [0, -1, 0],
    right: [1, 0, 0],
    up: [0, 0, 1],
    clockwiseArc: [degrees(150), degrees(30)],
    counterclockwiseArc: [degrees(210), degrees(330)],
  },
  L: {
    normal: [-1, 0, 0],
    right: [0, 0, 1],
    up: [0, 1, 0],
    clockwiseArc: [degrees(150), degrees(30)],
    counterclockwiseArc: [degrees(210), degrees(330)],
  },
  R: {
    normal: [1, 0, 0],
    right: [0, 0, -1],
    up: [0, 1, 0],
    clockwiseArc: [degrees(150), degrees(30)],
    counterclockwiseArc: [degrees(210), degrees(330)],
  },
  F: {
    normal: [0, 0, 1],
    right: [1, 0, 0],
    up: [0, 1, 0],
    clockwiseArc: [degrees(150), degrees(30)],
    counterclockwiseArc: [degrees(210), degrees(330)],
  },
  B: {
    normal: [0, 0, -1],
    right: [-1, 0, 0],
    up: [0, 1, 0],
    clockwiseArc: [degrees(150), degrees(30)],
    counterclockwiseArc: [degrees(210), degrees(330)],
  },
};

export function getArrowAffordancesForFace(
  face: Face,
): readonly [ArrowAffordance, ArrowAffordance] {
  const definition = FACE_ARROW_DEFINITIONS[face];
  const [clockwiseStart, clockwiseEnd] = definition.clockwiseArc;
  const [counterclockwiseStart, counterclockwiseEnd] =
    definition.counterclockwiseArc;
  const frame = {
    normal: definition.normal,
    right: definition.right,
    up: definition.up,
  };

  return [
    {
      direction: "clockwise",
      ...frame,
      startAngle: clockwiseStart,
      endAngle: clockwiseEnd,
      move: parseMoveNotation(face),
    },
    {
      direction: "counterclockwise",
      ...frame,
      startAngle: counterclockwiseStart,
      endAngle: counterclockwiseEnd,
      move: parseMoveNotation(`${face}'`),
    },
  ];
}
