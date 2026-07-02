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
