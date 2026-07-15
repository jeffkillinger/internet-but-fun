import { randomUUID } from "node:crypto";

/**
 * A minimal in-memory stand-in for the postgres.js `Sql`/`TransactionSql`
 * client, built specifically to drive `submitJoin` and
 * `getStatusFullResponse` through real transaction control flow (locking,
 * branching, writes, rollback) without a live database — per
 * docs/backend-milestone-03.md's instruction to use "an in-memory/mock SQL
 * layer" rather than hit the shared dev Supabase project.
 *
 * It is intentionally NOT a general SQL engine. Every query in join.ts and
 * status.ts is tagged with a leading `-- op:<name>` comment (a harmless
 * Postgres comment, no behavior change); this fake dispatches on that tag
 * rather than parsing SQL. It only understands the exact op names those two
 * files currently use — if a query's shape changes, its handler here must
 * be updated to match.
 */

export type FakeEpochRow = {
  id: string;
  game_id: string;
  status: "active" | "completed";
  scramble: unknown;
  cube_version: number;
  state_hash: string;
  move_count: number;
  started_at: Date;
};

export type FakeTurnRow = {
  id: string;
  game_id: string;
  epoch_id: string;
  actor_id: string;
  turn_token_hash: string;
  status: "ready_check" | "active" | "expired" | "skipped" | "completed";
  pending_move: string | null;
  expires_at: Date;
  created_at: Date;
  completed_at: Date | null;
};

export type FakeQueueEntryRow = {
  id: string;
  game_id: string;
  epoch_id: string;
  actor_id: string;
  status: "queued" | "ready_check" | "active" | "expired" | "skipped" | "completed";
  joined_at: Date;
  updated_at: Date;
};

export type FakeEventRow = {
  id: string;
  seq: number;
  game_id: string;
  epoch_id: string;
  actor_id: string | null;
  event_type: string;
  payload: unknown;
  created_at: Date;
};

export type FakeClaimRow = {
  id: string;
  game_id: string;
  epoch_id: string;
  actor_id: string;
  claimed_at: Date;
};

export type FakeStore = {
  epochs: FakeEpochRow[];
  turns: FakeTurnRow[];
  queue_entries: FakeQueueEntryRow[];
  events: FakeEventRow[];
  actor_claims: FakeClaimRow[];
};

export function createFakeStore(): FakeStore {
  return { epochs: [], turns: [], queue_entries: [], events: [], actor_claims: [] };
}

function cloneStore(store: FakeStore): FakeStore {
  return {
    epochs: store.epochs.map((row) => ({ ...row })),
    turns: store.turns.map((row) => ({ ...row })),
    queue_entries: store.queue_entries.map((row) => ({ ...row })),
    events: store.events.map((row) => ({ ...row })),
    actor_claims: store.actor_claims.map((row) => ({ ...row })),
  };
}

function restoreInto(target: FakeStore, snapshot: FakeStore): void {
  target.epochs = snapshot.epochs;
  target.turns = snapshot.turns;
  target.queue_entries = snapshot.queue_entries;
  target.events = snapshot.events;
  target.actor_claims = snapshot.actor_claims;
}

const FAKE_JSON = Symbol("fakeJsonParameter");

type FakeJsonParameter = { [FAKE_JSON]: true; value: unknown };

function isFakeJsonParameter(value: unknown): value is FakeJsonParameter {
  return typeof value === "object" && value !== null && FAKE_JSON in value;
}

function unwrapJson(value: unknown): unknown {
  return isFakeJsonParameter(value) ? value.value : value;
}

function extractOp(strings: readonly string[]): string {
  const match = strings[0]?.match(/--\s*op:(\S+)/);

  if (!match) {
    throw new Error(`fakeSql: query is missing an "-- op:<name>" tag: ${strings[0]}`);
  }

  return match[1];
}

const LIVE_TURN_STATUSES = new Set(["ready_check", "active"]);
const LIVE_QUEUE_STATUSES = new Set(["queued", "ready_check", "active"]);

function toTurnRow(row: FakeTurnRow) {
  return {
    id: row.id,
    actor_id: row.actor_id,
    status: row.status,
    expires_at: row.expires_at,
    pending_move: row.pending_move,
  };
}

function toQueueEntryRow(row: FakeQueueEntryRow) {
  return { id: row.id, actor_id: row.actor_id, joined_at: row.joined_at };
}

function sortTurnsCurrentFirst(rows: FakeTurnRow[]): FakeTurnRow[] {
  return [...rows].sort((a, b) => {
    const statusRank = (status: string) => (status === "active" ? 0 : 1);
    return (
      statusRank(a.status) - statusRank(b.status) ||
      a.expires_at.getTime() - b.expires_at.getTime() ||
      a.id.localeCompare(b.id)
    );
  });
}

function sortQueueEntries(rows: FakeQueueEntryRow[]): FakeQueueEntryRow[] {
  return [...rows].sort(
    (a, b) => a.joined_at.getTime() - b.joined_at.getTime() || a.id.localeCompare(b.id),
  );
}

export type FakeSqlOptions = {
  /** Throw a custom (test-supplied) error the first time a given op runs. */
  failOn?: Partial<Record<string, () => never>>;
};

export type FakeSql = ((
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown[]>) & {
  json: (value: unknown) => unknown;
  begin: <T>(
    optionsOrFn: string | ((sql: FakeSql) => T | Promise<T>),
    maybeFn?: (sql: FakeSql) => T | Promise<T>,
  ) => Promise<T>;
};

export function createFakeSql(store: FakeStore, options: FakeSqlOptions = {}): FakeSql {
  const call = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const op = extractOp(strings);

    options.failOn?.[op]?.();

    switch (op) {
      case "lock_active_epoch": {
        const [epochId] = values as [string];
        const row = store.epochs.find(
          (r) => r.id === epochId && r.game_id === "rubiks-cube" && r.status === "active",
        );
        return row ? [{ id: row.id }] : [];
      }

      case "current_active_epoch": {
        const sorted = store.epochs
          .filter((row) => row.game_id === "rubiks-cube" && row.status === "active")
          .sort((a, b) => b.started_at.getTime() - a.started_at.getTime());

        return sorted[0] ? [{ id: sorted[0].id }] : [];
      }

      case "status_active_epoch": {
        const sorted = store.epochs
          .filter((row) => row.game_id === "rubiks-cube" && row.status === "active")
          .sort((a, b) => b.started_at.getTime() - a.started_at.getTime());
        const row = sorted[0];

        if (!row) return [];

        return [
          {
            id: row.id,
            game_id: row.game_id,
            scramble: row.scramble,
            cube_version: row.cube_version,
            state_hash: row.state_hash,
            move_count: row.move_count,
          },
        ];
      }

      case "get_claim":
      case "status_claim": {
        const [epochId, actorId] = values as [string, string];
        return store.actor_claims
          .filter((row) => row.epoch_id === epochId && row.actor_id === actorId)
          .map((row) => ({ actor_id: row.actor_id }));
      }

      case "get_owned_live_turn": {
        const [epochId, actorId] = values as [string, string];
        return store.turns
          .filter(
            (row) =>
              row.epoch_id === epochId &&
              row.actor_id === actorId &&
              LIVE_TURN_STATUSES.has(row.status),
          )
          .map(toTurnRow);
      }

      case "get_owned_queue_entry_multi": {
        const [epochId, actorId] = values as [string, string];
        return store.queue_entries
          .filter(
            (row) =>
              row.epoch_id === epochId &&
              row.actor_id === actorId &&
              LIVE_QUEUE_STATUSES.has(row.status),
          )
          .map(toQueueEntryRow);
      }

      case "get_owned_active_turn": {
        const [epochId, actorId] = values as [string, string];
        return store.turns
          .filter(
            (row) =>
              row.epoch_id === epochId && row.actor_id === actorId && row.status === "active",
          )
          .map(toTurnRow);
      }

      case "get_owned_queued_entry": {
        const [epochId, actorId] = values as [string, string];
        return store.queue_entries
          .filter(
            (row) =>
              row.epoch_id === epochId && row.actor_id === actorId && row.status === "queued",
          )
          .map(toQueueEntryRow);
      }

      case "live_turn_exists": {
        const [epochId] = values as [string];
        const found = store.turns.find(
          (row) => row.epoch_id === epochId && LIVE_TURN_STATUSES.has(row.status),
        );
        return found ? [{ id: found.id }] : [];
      }

      case "queue_entry_exists": {
        const [epochId] = values as [string];
        const found = store.queue_entries.find(
          (row) => row.epoch_id === epochId && LIVE_QUEUE_STATUSES.has(row.status),
        );
        return found ? [{ id: found.id }] : [];
      }

      case "next_seq": {
        const [epochId] = values as [string];
        const max = store.events
          .filter((row) => row.epoch_id === epochId)
          .reduce((acc, row) => Math.max(acc, row.seq), 0);
        return [{ next_seq: max + 1 }];
      }

      case "insert_turn": {
        const [turnRowId, epochId, actorId, tokenHash] = values as [
          string,
          string,
          string,
          string,
        ];
        store.turns.push({
          id: turnRowId,
          game_id: "rubiks-cube",
          epoch_id: epochId,
          actor_id: actorId,
          turn_token_hash: tokenHash,
          status: "active",
          pending_move: null,
          expires_at: new Date(Date.now() + 30_000),
          created_at: new Date(),
          completed_at: null,
        });
        return [];
      }

      case "insert_turn_started_event":
      case "insert_queue_joined_event": {
        const [seq, epochId, actorId, jsonPayload] = values as [
          number,
          string,
          string,
          unknown,
        ];
        store.events.push({
          id: randomUUID(),
          seq,
          game_id: "rubiks-cube",
          epoch_id: epochId,
          actor_id: actorId,
          event_type: op === "insert_turn_started_event" ? "turn_started" : "queue_joined",
          payload: unwrapJson(jsonPayload),
          created_at: new Date(),
        });
        return [];
      }

      case "insert_queue_entry": {
        const [epochId, actorId] = values as [string, string];
        store.queue_entries.push({
          id: randomUUID(),
          game_id: "rubiks-cube",
          epoch_id: epochId,
          actor_id: actorId,
          status: "queued",
          joined_at: new Date(),
          updated_at: new Date(),
        });
        return [];
      }

      case "list_queue_entries":
      case "status_queue_entries": {
        const [epochId] = values as [string];
        return sortQueueEntries(
          store.queue_entries.filter(
            (row) => row.epoch_id === epochId && row.status === "queued",
          ),
        ).map(toQueueEntryRow);
      }

      case "current_turn":
      case "status_current_turn": {
        const [epochId] = values as [string];
        return sortTurnsCurrentFirst(
          store.turns.filter(
            (row) => row.epoch_id === epochId && LIVE_TURN_STATUSES.has(row.status),
          ),
        ).map(toTurnRow);
      }

      case "status_move_log": {
        const [epochId] = values as [string];
        return store.events
          .filter((row) => row.epoch_id === epochId && row.event_type === "move_committed")
          .sort((a, b) => a.seq - b.seq)
          .map((row) => ({ seq: row.seq, payload: row.payload, created_at: row.created_at }));
      }

      case "status_best_score": {
        const completed = store.epochs.filter(
          (row) => row.game_id === "rubiks-cube" && row.status === "completed",
        );
        const best =
          completed.length > 0 ? Math.min(...completed.map((row) => row.move_count)) : null;
        return [{ best_score_moves: best }];
      }

      default:
        throw new Error(`fakeSql: unhandled op "${op}"`);
    }
  }) as FakeSql;

  call.json = (value: unknown) => ({ [FAKE_JSON]: true, value }) as FakeJsonParameter;

  call.begin = (async (
    optionsOrFn: string | ((sql: FakeSql) => unknown),
    maybeFn?: (sql: FakeSql) => unknown,
  ) => {
    const fn = typeof optionsOrFn === "function" ? optionsOrFn : maybeFn!;
    const snapshot = cloneStore(store);

    try {
      return await fn(call);
    } catch (error) {
      restoreInto(store, snapshot);
      throw error;
    }
  }) as FakeSql["begin"];

  return call;
}
