import { randomUUID } from "node:crypto";

import type { TransactionSql } from "postgres";

import type {
  ActorId,
  GameId,
  JoinGameResponse,
} from "@/src/lib/api/types";

import { getSql } from "../db/client";
import { isUuid } from "./actor-identity";
import {
  computeQueueSummary,
  computeViewerStatus,
  PublicApiError,
  toPublicTurnSummary,
  type ClaimRow,
  type QueueEntryRow,
  type TurnRow,
} from "./status";
import {
  deriveTurnToken,
  getTurnTokenSecret,
  hashTurnToken,
  mintYourTurnSummary,
  TurnTokenError,
} from "./turns";

/**
 * The branch-selection logic, isolated from all database I/O so it can be
 * tested with in-memory fixtures. The `already_moved` claim check is not
 * modeled here — it short-circuits earlier in `submitJoin` with a definite
 * response shape of its own.
 */
export type JoinAction =
  | { type: "idempotent_active"; turn: TurnRow }
  | { type: "idempotent_queued"; queueEntry: QueueEntryRow }
  | { type: "shortcut" }
  | { type: "queue" };

export function decideJoinAction(input: {
  ownedActiveTurn: TurnRow | null;
  ownedQueueEntry: QueueEntryRow | null;
  liveTurnExists: boolean;
  queueEntryExists: boolean;
}): JoinAction {
  if (input.ownedActiveTurn) {
    return { type: "idempotent_active", turn: input.ownedActiveTurn };
  }

  if (input.ownedQueueEntry) {
    return { type: "idempotent_queued", queueEntry: input.ownedQueueEntry };
  }

  if (!input.liveTurnExists && !input.queueEntryExists) {
    return { type: "shortcut" };
  }

  return { type: "queue" };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

/**
 * Only safe, non-parameter structural metadata — never the raw error object
 * (postgres.js's PostgresError can carry `.detail`/`.query`/`.parameters`,
 * which embed actual row values) and never the error `.message`.
 */
function sanitizedUniqueViolationInfo(error: unknown): {
  code?: string;
  constraint?: string;
  table?: string;
} {
  if (typeof error !== "object" || error === null) return {};

  const e = error as Record<string, unknown>;

  return {
    code: typeof e.code === "string" ? e.code : undefined,
    constraint: typeof e.constraint_name === "string" ? e.constraint_name : undefined,
    table: typeof e.table_name === "string" ? e.table_name : undefined,
  };
}

async function buildAcceptedResponse(
  tx: TransactionSql,
  input: { epochId: string; actorId: ActorId; viewerStatus: "active" | "queued" },
): Promise<JoinGameResponse> {
  const queueRows = await tx<QueueEntryRow[]>`
    -- op:list_queue_entries
    select id::text, actor_id::text, joined_at
    from queue_entries
    where epoch_id = ${input.epochId}::uuid and status = 'queued'
    order by joined_at asc, id asc
  `;
  const turnRows = await tx<TurnRow[]>`
    -- op:current_turn
    select id::text, actor_id::text, status, expires_at, pending_move
    from turns
    where epoch_id = ${input.epochId}::uuid and status in ('ready_check', 'active')
    order by
      case status when 'active' then 0 else 1 end,
      expires_at asc,
      id asc
  `;
  const currentTurn = turnRows[0] ?? null;

  return {
    accepted: true,
    epochId: input.epochId,
    viewerStatus: input.viewerStatus,
    queue: computeQueueSummary({ queueEntries: queueRows, actorId: input.actorId }),
    activeTurn: toPublicTurnSummary(currentTurn),
    yourTurn: mintYourTurnSummary({ turn: currentTurn, actorId: input.actorId }),
  };
}

export async function submitJoin(input: {
  gameId: GameId;
  epochId: string;
  actorId: ActorId;
}): Promise<JoinGameResponse> {
  if (input.gameId !== "rubiks-cube") {
    throw new PublicApiError("invalid_request", "Join requires gameId=rubiks-cube.", 400);
  }

  if (!isUuid(input.epochId)) {
    throw new PublicApiError("invalid_request", "epochId must be a UUID.", 400);
  }

  getTurnTokenSecret();

  const sql = getSql();

  try {
    return await sql.begin(async (tx) => {
      const [lockedEpoch] = await tx<{ id: string }[]>`
        -- op:lock_active_epoch
        select id::text
        from epochs
        where id = ${input.epochId}::uuid and game_id = 'rubiks-cube' and status = 'active'
        for update
      `;

      if (!lockedEpoch) {
        const [currentEpoch] = await tx<{ id: string }[]>`
          -- op:current_active_epoch
          select id::text
          from epochs
          where game_id = 'rubiks-cube' and status = 'active'
          order by started_at desc
          limit 1
        `;

        if (!currentEpoch) {
          throw new PublicApiError(
            "no_active_epoch",
            "No active Rubik's Cube epoch exists.",
            404,
          );
        }

        const [claim] = await tx<ClaimRow[]>`
          -- op:get_claim
          select actor_id::text
          from actor_claims
          where epoch_id = ${currentEpoch.id}::uuid and actor_id = ${input.actorId}::uuid
        `;
        const [turn] = await tx<TurnRow[]>`
          -- op:get_owned_live_turn
          select id::text, actor_id::text, status, expires_at, pending_move
          from turns
          where epoch_id = ${currentEpoch.id}::uuid
            and actor_id = ${input.actorId}::uuid
            and status in ('ready_check', 'active')
        `;
        const [queueEntry] = await tx<QueueEntryRow[]>`
          -- op:get_owned_queue_entry_multi
          select id::text, actor_id::text, joined_at
          from queue_entries
          where epoch_id = ${currentEpoch.id}::uuid
            and actor_id = ${input.actorId}::uuid
            and status in ('queued', 'ready_check', 'active')
        `;

        return {
          accepted: false,
          reason: "stale_epoch",
          currentEpochId: currentEpoch.id,
          viewerStatus: computeViewerStatus({
            actorId: input.actorId,
            claim: claim ?? null,
            turn: turn ?? null,
            queueEntry: queueEntry ?? null,
          }),
        };
      }

      const epochId = lockedEpoch.id;

      const [claim] = await tx<ClaimRow[]>`
        -- op:get_claim
        select actor_id::text
        from actor_claims
        where epoch_id = ${epochId}::uuid and actor_id = ${input.actorId}::uuid
      `;

      if (claim) {
        return {
          accepted: false,
          reason: "already_moved",
          currentEpochId: epochId,
          viewerStatus: "already_moved",
        };
      }

      const [ownedActiveTurn] = await tx<TurnRow[]>`
        -- op:get_owned_active_turn
        select id::text, actor_id::text, status, expires_at, pending_move
        from turns
        where epoch_id = ${epochId}::uuid and actor_id = ${input.actorId}::uuid and status = 'active'
      `;
      const [ownedQueueEntry] = await tx<QueueEntryRow[]>`
        -- op:get_owned_queued_entry
        select id::text, actor_id::text, joined_at
        from queue_entries
        where epoch_id = ${epochId}::uuid and actor_id = ${input.actorId}::uuid and status = 'queued'
      `;
      const [liveTurn] = await tx<{ id: string }[]>`
        -- op:live_turn_exists
        select id::text
        from turns
        where epoch_id = ${epochId}::uuid and status in ('ready_check', 'active')
        limit 1
      `;
      const [existingQueueEntry] = await tx<{ id: string }[]>`
        -- op:queue_entry_exists
        select id::text
        from queue_entries
        where epoch_id = ${epochId}::uuid and status in ('queued', 'ready_check', 'active')
        limit 1
      `;

      const action = decideJoinAction({
        ownedActiveTurn: ownedActiveTurn ?? null,
        ownedQueueEntry: ownedQueueEntry ?? null,
        liveTurnExists: Boolean(liveTurn),
        queueEntryExists: Boolean(existingQueueEntry),
      });

      if (action.type === "idempotent_active" || action.type === "idempotent_queued") {
        return buildAcceptedResponse(tx, {
          epochId,
          actorId: input.actorId,
          viewerStatus: action.type === "idempotent_active" ? "active" : "queued",
        });
      }

      const [{ next_seq: nextSeq }] = await tx<{ next_seq: number }[]>`
        -- op:next_seq
        select coalesce(max(seq), 0) + 1 as next_seq
        from events
        where epoch_id = ${epochId}::uuid
      `;

      if (action.type === "shortcut") {
        const turnRowId = randomUUID();
        const token = deriveTurnToken(turnRowId);
        const tokenHash = hashTurnToken(token);

        await tx`
          -- op:insert_turn
          insert into turns (id, game_id, epoch_id, actor_id, turn_token_hash, status, expires_at)
          values (
            ${turnRowId}::uuid,
            'rubiks-cube',
            ${epochId}::uuid,
            ${input.actorId}::uuid,
            ${tokenHash},
            'active',
            now() + interval '30 seconds'
          )
        `;
        await tx`
          -- op:insert_turn_started_event
          insert into events (seq, game_id, epoch_id, actor_id, event_type, payload)
          values (
            ${nextSeq},
            'rubiks-cube',
            ${epochId}::uuid,
            ${input.actorId}::uuid,
            'turn_started',
            ${sql.json({ via: "empty_queue_shortcut" })}
          )
        `;
      } else {
        await tx`
          -- op:insert_queue_entry
          insert into queue_entries (game_id, epoch_id, actor_id, status)
          values ('rubiks-cube', ${epochId}::uuid, ${input.actorId}::uuid, 'queued')
        `;
        await tx`
          -- op:insert_queue_joined_event
          insert into events (seq, game_id, epoch_id, actor_id, event_type, payload)
          values (
            ${nextSeq},
            'rubiks-cube',
            ${epochId}::uuid,
            ${input.actorId}::uuid,
            'queue_joined',
            ${sql.json({})}
          )
        `;
      }

      return buildAcceptedResponse(tx, {
        epochId,
        actorId: input.actorId,
        viewerStatus: action.type === "shortcut" ? "active" : "queued",
      });
    });
  } catch (error) {
    if (error instanceof PublicApiError) throw error;
    if (error instanceof TurnTokenError) throw error;

    if (isUniqueViolation(error)) {
      // Should be unreachable: the epoch-row lock already serializes every
      // join attempt against this epoch. If this fires, the locking logic
      // has a bug, not a race to paper over. Log only safe structural
      // metadata — never the raw error (may carry row-level detail) or the
      // query/parameters.
      console.error(
        "join: unexpected unique-index violation despite epoch-row lock",
        sanitizedUniqueViolationInfo(error),
      );
    }

    throw new PublicApiError("database_unavailable", "Database is unavailable.", 503);
  }
}
