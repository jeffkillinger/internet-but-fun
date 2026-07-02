import type { Face } from "../../../src/lib/cube";

/**
 * Shared world-space convention for the 3D Rubik's Cube renderer:
 *
 * +Y = Up,    -Y = Down
 * +Z = Front, -Z = Back
 * +X = Right, -X = Left
 *
 * Future canonical cube-state mapping must preserve this convention.
 */
export const CUBIE_COORDINATES = [-1, 0, 1] as const;

export type CubieCoordinate = (typeof CUBIE_COORDINATES)[number];
export type CubiePosition = readonly [
  x: CubieCoordinate,
  y: CubieCoordinate,
  z: CubieCoordinate,
];

export const CUBIE_SIZE = 0.94;

export const CUBE_COLORS = {
  up: "#ffffff",
  down: "#ffd500",
  front: "#009b48",
  back: "#0046ad",
  right: "#b71234",
  left: "#ff5800",
  interior: "#171717",
} as const;

/**
 * BoxGeometry groups use this material order:
 * +X, -X, +Y, -Y, +Z, -Z.
 */
export const BOX_MATERIAL_FACES = [
  "right",
  "left",
  "up",
  "down",
  "front",
  "back",
] as const;

export type CubeFace = (typeof BOX_MATERIAL_FACES)[number];

export const CANONICAL_FACE_OFFSETS: Readonly<Record<Face, number>> = {
  U: 0,
  R: 9,
  F: 18,
  D: 27,
  L: 36,
  B: 45,
};

export const CANONICAL_FACE_TO_CUBE_FACE: Readonly<Record<Face, CubeFace>> = {
  U: "up",
  R: "right",
  F: "front",
  D: "down",
  L: "left",
  B: "back",
};

export const CANONICAL_STICKER_COLORS: Readonly<Record<Face, string>> = {
  U: CUBE_COLORS.up,
  R: CUBE_COLORS.right,
  F: CUBE_COLORS.front,
  D: CUBE_COLORS.down,
  L: CUBE_COLORS.left,
  B: CUBE_COLORS.back,
};

/**
 * Canonical facelets are U, R, F, D, L, B blocks, each scanned row-major
 * (local indexes 0..8) as that face is viewed straight-on from outside.
 * The arrays below map each local index to [x, y, z]; add the corresponding
 * CANONICAL_FACE_OFFSETS value to obtain the global CubeState index.
 *
 * U, viewed from +Y: rows run -Z to +Z; columns run -X to +X.
 * R, viewed from +X: rows run +Y to -Y; columns run +Z to -Z.
 * F, viewed from +Z: rows run +Y to -Y; columns run -X to +X.
 * D, viewed from -Y: rows run +Z to -Z; columns run -X to +X.
 * L, viewed from -X: rows run +Y to -Y; columns run -Z to +Z.
 * B, viewed from -Z: rows run +Y to -Y; columns run +X to -X.
 *
 * CubeNet renders these same six contiguous blocks in this same row-major
 * order without reorientation. Thus local index 0 is its top-left sticker,
 * index 1 top-center, ..., and index 8 bottom-right.
 */
export const FACELET_POSITIONS: Readonly<
  Record<Face, readonly CubiePosition[]>
> = {
  U: [
    [-1, 1, -1], [0, 1, -1], [1, 1, -1],
    [-1, 1, 0], [0, 1, 0], [1, 1, 0],
    [-1, 1, 1], [0, 1, 1], [1, 1, 1],
  ],
  R: [
    [1, 1, 1], [1, 1, 0], [1, 1, -1],
    [1, 0, 1], [1, 0, 0], [1, 0, -1],
    [1, -1, 1], [1, -1, 0], [1, -1, -1],
  ],
  F: [
    [-1, 1, 1], [0, 1, 1], [1, 1, 1],
    [-1, 0, 1], [0, 0, 1], [1, 0, 1],
    [-1, -1, 1], [0, -1, 1], [1, -1, 1],
  ],
  D: [
    [-1, -1, 1], [0, -1, 1], [1, -1, 1],
    [-1, -1, 0], [0, -1, 0], [1, -1, 0],
    [-1, -1, -1], [0, -1, -1], [1, -1, -1],
  ],
  L: [
    [-1, 1, -1], [-1, 1, 0], [-1, 1, 1],
    [-1, 0, -1], [-1, 0, 0], [-1, 0, 1],
    [-1, -1, -1], [-1, -1, 0], [-1, -1, 1],
  ],
  B: [
    [1, 1, -1], [0, 1, -1], [-1, 1, -1],
    [1, 0, -1], [0, 0, -1], [-1, 0, -1],
    [1, -1, -1], [0, -1, -1], [-1, -1, -1],
  ],
};
