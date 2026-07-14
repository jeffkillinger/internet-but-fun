import type {
  ActorId,
  GameId,
  PublicCommittedMove,
  PublicTurnSummary,
  QueueSummary,
  StatusFullResponse,
  YourTurnSummary,
  ViewerStatus,
} from "@/src/lib/api/types";
import { parseMoveNotation } from "../cube";

import { getSql } from "../db/client";
import { parseStoredScramble } from "./epoch";

export class PublicApiError extends Error {
  constructor(
    public readonly code:
      | "database_unavailable"
      | "conflicting_viewer_state"
      | "invalid_request"
      | "malformed_stored_scramble"
      | "no_active_epoch"
      | "turn_token_unrecoverable",
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

type ClaimRow = {
  actor_id: string;
};

type QueueEntryRow = {
  id: string;
  actor_id: string;
  joined_at: Date;
};

type TurnRow = {
  id: string;
  actor_id: string;
  status: "ready_check" | "active";
  expires_at: Date;
  pending_move: string | null;
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

export function computeQueueSummary(input: {
  queueEntries: QueueEntryRow[];
  actorId: ActorId;
}): QueueSummary {
  const sorted = [...input.queueEntries].sort((a, b) => {
    const joinedDiff = a.joined_at.getTime() - b.joined_at.getTime();
    return joinedDiff || a.id.localeCompare(b.id);
  });
  const viewerIndex = sorted.findIndex((entry) => entry.actor_id === input.actorId);

  return {
    queueLength: sorted.length,
    viewerPosition: viewerIndex === -1 ? null : viewerIndex + 1,
  };
}

export function toPublicTurnSummary(turn: TurnRow | null): PublicTurnSummary | null {
  if (!turn) return null;

  return {
    status: turn.status,
    expiresAt: turn.expires_at.toISOString(),
    pendingMove: turn.pending_move ? parseMoveNotation(turn.pending_move).notation : null,
  };
}

export function toYourTurnSummary(input: {
  turn: TurnRow | null;
  actorId: ActorId;
}): YourTurnSummary | null {
  if (!input.turn || input.turn.actor_id !== input.actorId) return null;

  return {
    turnId: input.turn.id,
    status: input.turn.status,
    expiresAt: input.turn.expires_at.toISOString(),
  };
}

export function computeViewerStatus(input: {
  claim: ClaimRow | null;
  turn: TurnRow | null;
  queueEntry: QueueEntryRow | null;
  actorId: ActorId;
}): ViewerStatus {
  if (input.claim) return "already_moved";

  if (input.turn?.actor_id === input.actorId && input.turn.status === "active") {
    return "active";
  }

  if (
    input.turn?.actor_id === input.actorId &&
    input.turn.status === "ready_check"
  ) {
    return "ready_check";
  }

  if (input.queueEntry) return "queued";

  return "can_play";
}

function assertAtMostOne<T>(rows: T[], message: string): T | null {
  if (rows.length > 1) {
    throw new PublicApiError("conflicting_viewer_state", message, 500);
  }

  return rows[0] ?? null;
}

function selectCurrentTurn(rows: TurnRow[]): TurnRow | null {
  if (rows.length > 1) {
    throw new PublicApiError(
      "conflicting_viewer_state",
      "Multiple current ready-check or active turns exist.",
      500,
    );
  }

  return rows[0] ?? null;
}

function assertRecoverableTurnToken(input: {
  currentTurn: TurnRow | null;
  actorId: ActorId;
}): void {
  if (input.currentTurn?.actor_id !== input.actorId) return;

  throw new PublicApiError(
    "turn_token_unrecoverable",
    "Private turn credential is unavailable.",
    500,
  );
}

export function createStatusFullResponse(input: {
  epoch: EpochRow;
  moveLog: PublicCommittedMove[];
  bestScoreMoves: number | null;
  actorId?: ActorId;
  claim?: ClaimRow | null;
  queueEntries?: QueueEntryRow[];
  viewerQueueEntry?: QueueEntryRow | null;
  currentTurn?: TurnRow | null;
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

  const actorId = input.actorId;
  const queueEntries = input.queueEntries ?? [];
  const currentTurn = input.currentTurn ?? null;
  const queue = actorId
    ? computeQueueSummary({ queueEntries, actorId })
    : { queueLength: queueEntries.length, viewerPosition: null };
  const viewerStatus = actorId
    ? computeViewerStatus({
        actorId,
        claim: input.claim ?? null,
        turn: currentTurn,
        queueEntry: input.viewerQueueEntry ?? null,
      })
    : "can_play";

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
    viewerStatus,
    queue,
    activeTurn: toPublicTurnSummary(currentTurn),
    yourTurn: actorId ? toYourTurnSummary({ turn: currentTurn, actorId }) : null,
  };
}

export async function getStatusFullResponse(
  gameId: GameId,
  actorId: ActorId,
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
    const claimRows = await sql<ClaimRow[]>`
      select actor_id::text
      from actor_claims
      where epoch_id = ${epoch.id}::uuid and actor_id = ${actorId}::uuid
    `;
    const queueRows = await sql<QueueEntryRow[]>`
      select id::text, actor_id::text, joined_at
      from queue_entries
      where epoch_id = ${epoch.id}::uuid and status = 'queued'
      order by joined_at asc, id asc
    `;
    const viewerQueueRows = queueRows.filter((row) => row.actor_id === actorId);
    const turnRows = await sql<TurnRow[]>`
      select id::text, actor_id::text, status, expires_at, pending_move
      from turns
      where epoch_id = ${epoch.id}::uuid and status in ('ready_check', 'active')
      order by
        case status when 'active' then 0 else 1 end,
        expires_at asc,
        id asc
    `;

    const currentTurn = selectCurrentTurn(turnRows);

    assertRecoverableTurnToken({ currentTurn, actorId });

    return createStatusFullResponse({
      epoch,
      moveLog: moveRows.map(toPublicCommittedMove),
      bestScoreMoves: bestScore?.best_score_moves ?? null,
      actorId,
      claim: assertAtMostOne(
        claimRows,
        "Multiple actor claims exist for the current epoch.",
      ),
      queueEntries: queueRows,
      viewerQueueEntry: assertAtMostOne(
        viewerQueueRows,
        "Multiple current queue entries exist for this actor.",
      ),
      currentTurn,
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
