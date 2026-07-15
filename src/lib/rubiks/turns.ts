import { createHash, createHmac } from "node:crypto";

import type { ActorId, YourTurnSummary } from "@/src/lib/api/types";
import type { TurnRow } from "./status";

export class TurnTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TurnTokenError";
  }
}

export function getTurnTokenSecret(): string {
  const secret = process.env.TURN_TOKEN_SECRET;

  if (!secret) {
    throw new TurnTokenError("TURN_TOKEN_SECRET is not configured.");
  }

  return secret;
}

/**
 * Deterministic, not random: a pure function of the turn row's own immutable
 * id and the server secret. Stable for the turn's whole life and
 * recomputable identically on any read, so the raw token never needs to be
 * stored or cached anywhere.
 */
export function deriveTurnToken(turnRowId: string): string {
  return createHmac("sha256", getTurnTokenSecret())
    .update(turnRowId)
    .digest("base64url");
}

export function hashTurnToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Given a turn row already confirmed to belong to actorId, re-derives the
 * bearer token from the row's id. turn_token_hash stays the actual
 * validation target (hash the presented token, compare); this only recovers
 * the raw value for redelivery.
 */
export function mintYourTurnSummary(input: {
  turn: TurnRow | null;
  actorId: ActorId;
}): YourTurnSummary | null {
  if (!input.turn || input.turn.actor_id !== input.actorId) return null;

  return {
    turnId: deriveTurnToken(input.turn.id),
    status: input.turn.status,
    expiresAt: input.turn.expires_at.toISOString(),
  };
}
