import type {
  GameId,
  PublicCommittedMove,
  StatusFullResponse,
  ViewerStatus,
} from "@/src/lib/api/types";
import { parseMoveNotation } from "../cube";

import { getSql } from "../db/client";
import { parseStoredScramble } from "./epoch";

export class PublicApiError extends Error {
  constructor(
    public readonly code:
      | "database_unavailable"
      | "invalid_request"
      | "malformed_stored_scramble"
      | "no_active_epoch",
    message: string,
    public readonly status = 500,
  ) {
    super(message);
  }
}

type EpochRow = {
  id: string;
  game_id: GameId;
  scramble: unknown;
  cube_version: number;
  state_hash: string;
  move_count: number;
};

type MoveEventRow = {
  seq: number;
  payload: unknown;
  created_at: Date;
};

type BestScoreRow = {
  best_score_moves: number | null;
};

type MovePayload = {
  move?: unknown;
  moveNumber?: unknown;
  move_number?: unknown;
  cubeVersion?: unknown;
  cube_version?: unknown;
};

export function toPublicCommittedMove(row: MoveEventRow): PublicCommittedMove {
  const payload = row.payload as MovePayload;
  const move = typeof payload.move === "string" ? payload.move : null;
  const cubeVersion =
    typeof payload.cubeVersion === "number"
      ? payload.cubeVersion
      : typeof payload.cube_version === "number"
        ? payload.cube_version
        : null;
  const moveNumber =
    typeof payload.moveNumber === "number"
      ? payload.moveNumber
      : typeof payload.move_number === "number"
        ? payload.move_number
        : row.seq - 1;

  if (!move || cubeVersion === null) {
    throw new PublicApiError(
      "malformed_stored_scramble",
      "Stored move event payload is malformed.",
      500,
    );
  }

  return {
    moveNumber,
    cubeVersion,
    move: parseMoveNotation(move).notation,
    createdAt: row.created_at.toISOString(),
  };
}

export function createStatusFullResponse(input: {
  epoch: EpochRow;
  moveLog: PublicCommittedMove[];
  bestScoreMoves: number | null;
  viewerStatus?: ViewerStatus;
}): StatusFullResponse {
  let scramble;

  try {
    scramble = parseStoredScramble(input.epoch.scramble);
  } catch (error) {
    throw new PublicApiError(
      "malformed_stored_scramble",
      error instanceof Error ? error.message : "Stored scramble is malformed.",
      500,
    );
  }

  return {
    mode: "full",
    gameId: "rubiks-cube",
    epochId: input.epoch.id,
    cubeVersion: input.epoch.cube_version,
    stateHash: input.epoch.state_hash,
    moveCount: input.epoch.move_count,
    bestScoreMoves: input.bestScoreMoves,
    scramble,
    moveLog: input.moveLog,
    viewerStatus: input.viewerStatus ?? "can_play",
    queue: {
      queueLength: 0,
      viewerPosition: null,
    },
    activeTurn: null,
    yourTurn: null,
  };
}

export async function getStatusFullResponse(
  gameId: GameId,
): Promise<StatusFullResponse> {
  if (gameId !== "rubiks-cube") {
    throw new PublicApiError(
      "invalid_request",
      "Unsupported gameId.",
      400,
    );
  }

  try {
    const sql = getSql();
    const [epoch] = await sql<EpochRow[]>`
      select id::text, game_id, scramble, cube_version, state_hash, move_count
      from epochs
      where game_id = 'rubiks-cube' and status = 'active'
      order by started_at desc
      limit 1
    `;

    if (!epoch) {
      throw new PublicApiError(
        "no_active_epoch",
        "No active Rubik's Cube epoch exists.",
        404,
      );
    }

    const moveRows = await sql<MoveEventRow[]>`
      select seq, payload, created_at
      from events
      where epoch_id = ${epoch.id}::uuid and event_type = 'move_committed'
      order by seq asc
    `;
    const [bestScore] = await sql<BestScoreRow[]>`
      select min(move_count)::int as best_score_moves
      from epochs
      where game_id = 'rubiks-cube' and status = 'completed'
    `;

    return createStatusFullResponse({
      epoch,
      moveLog: moveRows.map(toPublicCommittedMove),
      bestScoreMoves: bestScore?.best_score_moves ?? null,
    });
  } catch (error) {
    if (error instanceof PublicApiError) throw error;

    throw new PublicApiError(
      "database_unavailable",
      "Database is unavailable.",
      503,
    );
  }
}
