import type { MoveNotation } from "@/src/lib/cube";

export type GameId = "rubiks-cube";

export type ActorId = string;
export type EpochId = string;
export type TurnId = string;

export type CubeVersion = number;
export type CubeStateHash = string;

export type ViewerStatus =
  | "can_play"
  | "queued"
  | "ready_check"
  | "active"
  | "already_moved";

export type PublicTurnStatus = "ready_check" | "active";

export type MoveRejectionReason =
  | "not_your_turn"
  | "turn_expired"
  | "stale_cube_version"
  | "stale_epoch"
  | "already_moved"
  | "invalid_move";

export type DeltaRefetchReason = "stale_epoch" | "cursor_too_old";

/**
 * Public committed-move data.
 *
 * Raw actor IDs remain in the internal event log and are deliberately omitted
 * from public status responses.
 */
export type PublicCommittedMove = {
  moveNumber: number;
  cubeVersion: CubeVersion;
  move: MoveNotation;
  createdAt: string;
};

/**
 * Safe for every viewer. This type must never contain the bearer turn token.
 */
export type PublicTurnSummary = {
  status: PublicTurnStatus;
  expiresAt: string;
  pendingMove: MoveNotation | null;
};

/**
 * Returned only when the authenticated actor cookie belongs to the holder of
 * the current ready-check or active turn.
 */
export type YourTurnSummary = {
  turnId: TurnId;
  status: PublicTurnStatus;
  expiresAt: string;
};

export type QueueSummary = {
  queueLength: number;
  viewerPosition: number | null;
};

export type JoinGameRequest = {
  gameId: GameId;
  epochId: EpochId;
};

export type JoinGameResponse =
  | {
      accepted: true;
      epochId: EpochId;
      viewerStatus: "queued" | "active";
      queue: QueueSummary;
      activeTurn: PublicTurnSummary | null;
      yourTurn: YourTurnSummary | null;
    }
  | {
      accepted: false;
      reason: "already_moved" | "stale_epoch";
      currentEpochId: EpochId;
      viewerStatus: ViewerStatus;
    };

export type StartTurnRequest = {
  gameId: GameId;
  epochId: EpochId;
  turnId: TurnId;
};

export type StartTurnResponse =
  | {
      accepted: true;
      epochId: EpochId;
      viewerStatus: "active";
      activeTurn: PublicTurnSummary;
      yourTurn: YourTurnSummary;
    }
  | {
      accepted: false;
      reason: "not_your_turn" | "turn_expired" | "stale_epoch";
      currentEpochId: EpochId;
      viewerStatus: ViewerStatus;
    };

export type SubmitMoveRequest = {
  gameId: GameId;
  epochId: EpochId;
  turnId: TurnId;
  move: MoveNotation;
  expectedCubeVersion: CubeVersion;
};

export type SubmitMoveResponse =
  | {
      accepted: true;
      epochId: EpochId;
      moveNumber: number;
      cubeVersion: CubeVersion;
      stateHash: CubeStateHash;
      viewerStatus: "already_moved";
    }
  | {
      accepted: false;
      reason: MoveRejectionReason;
      currentEpochId: EpochId;
      currentCubeVersion: CubeVersion;
      stateHash: CubeStateHash;
      viewerStatus: ViewerStatus;
    };

export type StatusDeltaRequest = {
  gameId: GameId;
  epochId: EpochId;
  fromVersion: CubeVersion;
};

export type StatusDeltaResponse =
  | {
      mode: "delta";
      epochId: EpochId;
      cubeVersion: CubeVersion;
      stateHash: CubeStateHash;
      moveCount: number;
      bestScoreMoves: number | null;
      newMoves: PublicCommittedMove[];
      viewerStatus: ViewerStatus;
      queue: QueueSummary;
      activeTurn: PublicTurnSummary | null;
      yourTurn: YourTurnSummary | null;
      shouldRefetchFull: false;
    }
  | {
      mode: "delta";
      epochId: EpochId;
      cubeVersion: CubeVersion;
      stateHash: CubeStateHash;
      viewerStatus: ViewerStatus;
      shouldRefetchFull: true;
      reason: DeltaRefetchReason;
    };

/**
 * Full status always returns the server's current epoch. The client does not
 * select an epoch for this request.
 */
export type StatusFullRequest = {
  gameId: GameId;
};

export type StatusFullResponse = {
  mode: "full";
  gameId: GameId;
  epochId: EpochId;
  cubeVersion: CubeVersion;
  stateHash: CubeStateHash;
  moveCount: number;
  bestScoreMoves: number | null;
  scramble: MoveNotation[];
  moveLog: PublicCommittedMove[];
  viewerStatus: ViewerStatus;
  queue: QueueSummary;
  activeTurn: PublicTurnSummary | null;
  yourTurn: YourTurnSummary | null;
};

export type ArcadeEventType =
  | "epoch_started"
  | "queue_joined"
  | "ready_check_started"
  | "turn_started"
  | "turn_expired"
  | "move_committed"
  | "epoch_completed";

/**
 * Internal durable event-log record.
 *
 * This type is not an API response. Internal events may contain the true actor
 * ID even though public move/status responses do not expose it.
 */
export type ArcadeEvent = {
  id: string;
  seq: number;
  gameId: GameId;
  epochId: EpochId;
  actorId: ActorId | null;
  eventType: ArcadeEventType;
  payload: unknown;
  createdAt: string;
};
