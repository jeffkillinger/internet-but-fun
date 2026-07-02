/**
 * Canonical Rubik's Cube state and move logic.
 *
 * This module is independent of rendering so the server, tests, and any future
 * renderer all use identical rules. The future server will accept move intent,
 * rather than client-supplied state, so it can validate and apply every change
 * to the canonical state itself. Renderers are consumers of that state, never
 * alternative sources of truth.
 */

export const FACES = ["U", "R", "F", "D", "L", "B"] as const;

export type Face = (typeof FACES)[number];
export type MoveNotation = `${Face}` | `${Face}'` | `${Face}2`;
export type TurnAmount = 1 | -1 | 2;

export type Move = Readonly<{
  face: Face;
  amount: TurnAmount;
  notation: MoveNotation;
}>;

/** Facelets are ordered U, R, F, D, L, B; each face is row-major. */
export type CubeState = ReadonlyArray<Face>;

type Vector = readonly [number, number, number];
type FaceletGeometry = Readonly<{
  position: Vector;
  normal: Vector;
}>;

const FACE_SET: ReadonlySet<string> = new Set(FACES);

function faceletGeometry(face: Face, row: number, column: number): FaceletGeometry {
  const horizontal = column - 1;
  const vertical = 1 - row;

  switch (face) {
    case "U":
      return { position: [horizontal, 1, row - 1], normal: [0, 1, 0] };
    case "R":
      return { position: [1, vertical, 1 - column], normal: [1, 0, 0] };
    case "F":
      return { position: [horizontal, vertical, 1], normal: [0, 0, 1] };
    case "D":
      return { position: [horizontal, -1, 1 - row], normal: [0, -1, 0] };
    case "L":
      return { position: [-1, vertical, column - 1], normal: [-1, 0, 0] };
    case "B":
      return { position: [1 - column, vertical, -1], normal: [0, 0, -1] };
  }
}

const FACELETS: readonly FaceletGeometry[] = FACES.flatMap((face) =>
  Array.from({ length: 9 }, (_, index) =>
    faceletGeometry(face, Math.floor(index / 3), index % 3),
  ),
);

const GEOMETRY_INDEX = new Map(
  FACELETS.map(({ position, normal }, index) => [
    `${position.join(",")}|${normal.join(",")}`,
    index,
  ]),
);

const NORMALS: Readonly<Record<Face, Vector>> = {
  U: [0, 1, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  B: [0, 0, -1],
};

function rotateClockwise(vector: Vector, axis: Vector): Vector {
  const [x, y, z] = vector;
  const [a, b, c] = axis;
  const dot = x * a + y * b + z * c;

  // Rodrigues' formula for a -90 degree rotation around the outward normal.
  return [
    -b * z + c * y + a * dot,
    -c * x + a * z + b * dot,
    -a * y + b * x + c * dot,
  ];
}

function applyQuarterTurn(cube: CubeState, face: Face): CubeState {
  assertCubeState(cube);
  const axis = NORMALS[face];
  const result = [...cube];

  FACELETS.forEach(({ position, normal }, sourceIndex) => {
    const onLayer =
      position[0] * axis[0] + position[1] * axis[1] + position[2] * axis[2] === 1;

    if (!onLayer) return;

    const nextPosition = rotateClockwise(position, axis);
    const nextNormal = rotateClockwise(normal, axis);
    const targetIndex = GEOMETRY_INDEX.get(
      `${nextPosition.join(",")}|${nextNormal.join(",")}`,
    );

    if (targetIndex === undefined) {
      throw new Error("Cube geometry produced an invalid facelet position.");
    }

    result[targetIndex] = cube[sourceIndex];
  });

  return result;
}

function assertCubeState(cube: CubeState): void {
  if (cube.length !== 54) {
    throw new Error(`A cube state must contain 54 facelets; received ${cube.length}.`);
  }

  const counts = new Map<Face, number>(FACES.map((face) => [face, 0]));
  for (const facelet of cube) {
    if (!FACE_SET.has(facelet)) {
      throw new Error(`Invalid cube facelet: ${String(facelet)}.`);
    }
    counts.set(facelet, (counts.get(facelet) ?? 0) + 1);
  }

  for (const face of FACES) {
    if (counts.get(face) !== 9) {
      throw new Error(`A cube state must contain exactly nine ${face} facelets.`);
    }
  }
}

export function createSolvedCube(): CubeState {
  return FACES.flatMap((face) => Array<Face>(9).fill(face));
}

export function parseMoveNotation(input: string): Move {
  if (!/^[URFDLB](?:'|2)?$/.test(input)) {
    throw new Error(`Invalid move notation: "${input}".`);
  }

  const notation = input as MoveNotation;
  return {
    face: notation[0] as Face,
    amount: notation.endsWith("'") ? -1 : notation.endsWith("2") ? 2 : 1,
    notation,
  };
}

export function applyMove(cube: CubeState, move: Move | MoveNotation): CubeState {
  const parsed = typeof move === "string" ? parseMoveNotation(move) : move;
  const turns = parsed.amount === -1 ? 3 : parsed.amount;
  let result = [...cube];

  for (let turn = 0; turn < turns; turn += 1) {
    result = [...applyQuarterTurn(result, parsed.face)];
  }

  return result;
}

export function applyMoves(
  cube: CubeState,
  moves: readonly (Move | MoveNotation)[],
): CubeState {
  return moves.reduce<CubeState>((state, move) => applyMove(state, move), cube);
}

export function isSolved(cube: CubeState): boolean {
  assertCubeState(cube);
  return FACES.every((_, faceIndex) => {
    const offset = faceIndex * 9;
    return cube.slice(offset, offset + 9).every((facelet) => facelet === cube[offset]);
  });
}

export function serializeCube(cube: CubeState): string {
  assertCubeState(cube);
  return cube.join("");
}

export function deserializeCube(serialized: string): CubeState {
  const cube = [...serialized] as Face[];
  assertCubeState(cube);
  return cube;
}

export function generateScramble(length = 20): Move[] {
  if (!Number.isInteger(length) || length < 0) {
    throw new Error("Scramble length must be a non-negative integer.");
  }

  const suffixes = ["", "'", "2"] as const;
  const moves: Move[] = [];
  let previousFace: Face | undefined;

  while (moves.length < length) {
    const availableFaces = FACES.filter((face) => face !== previousFace);
    const face = availableFaces[Math.floor(Math.random() * availableFaces.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const move = parseMoveNotation(`${face}${suffix}`);
    moves.push(move);
    previousFace = face;
  }

  return moves;
}

/** Counts moves using Half Turn Metric: quarter, inverse, and half turns each count once. */
export function countMoves(moves: readonly (Move | MoveNotation)[]): number {
  for (const move of moves) {
    if (typeof move === "string") parseMoveNotation(move);
  }
  return moves.length;
}
