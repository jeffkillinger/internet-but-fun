import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type { ActorId } from "@/src/lib/api/types";

export const ACTOR_COOKIE_NAME = "ibf_actor";
export const ACTOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
export const ACTOR_COOKIE_REFRESH_AFTER_SECONDS = 60 * 60 * 24 * 30;

type ActorCookiePayload = {
  v: 1;
  actorId: ActorId;
  issuedAt: number;
};

export type ActorCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

export type ActorIdentityResolution = {
  actorId: ActorId;
  cookieValue: string;
  shouldSetCookie: boolean;
  reason: "missing" | "valid" | "invalid" | "refresh";
};

export class ActorIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActorIdentityError";
  }
}

export function getActorCookieOptions(
  nodeEnv = process.env.NODE_ENV,
): ActorCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: nodeEnv === "production",
    path: "/",
    maxAge: ACTOR_COOKIE_MAX_AGE_SECONDS,
  };
}

export function getActorCookieSecret(): string {
  const secret = process.env.ACTOR_COOKIE_SECRET;

  if (!secret) {
    throw new ActorIdentityError("ACTOR_COOKIE_SECRET is not configured.");
  }

  return secret;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function toBase64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function signatureMatches(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && timingSafeEqual(left, right);
}

export function createSignedActorCookie(
  actorId: ActorId,
  nowMs = Date.now(),
): string {
  if (!isUuid(actorId)) {
    throw new ActorIdentityError("Actor cookie actorId must be a UUID.");
  }

  const secret = getActorCookieSecret();
  const payload: ActorCookiePayload = {
    v: 1,
    actorId,
    issuedAt: Math.floor(nowMs / 1000),
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export function parseSignedActorCookie(
  cookieValue: string,
): ActorCookiePayload | null {
  const secret = getActorCookieSecret();
  const [encodedPayload, signature, extra] = cookieValue.split(".");

  if (!encodedPayload || !signature || extra !== undefined) return null;

  const expectedSignature = signPayload(encodedPayload, secret);
  if (!signatureMatches(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as Partial<ActorCookiePayload>;

    if (
      payload.v !== 1 ||
      typeof payload.actorId !== "string" ||
      !isUuid(payload.actorId) ||
      typeof payload.issuedAt !== "number" ||
      !Number.isFinite(payload.issuedAt)
    ) {
      return null;
    }

    return {
      v: 1,
      actorId: payload.actorId,
      issuedAt: payload.issuedAt,
    };
  } catch {
    return null;
  }
}

export function resolveActorIdentity(
  cookieValue: string | undefined,
  nowMs = Date.now(),
): ActorIdentityResolution {
  if (!cookieValue) {
    const actorId = randomUUID();

    return {
      actorId,
      cookieValue: createSignedActorCookie(actorId, nowMs),
      shouldSetCookie: true,
      reason: "missing",
    };
  }

  const payload = parseSignedActorCookie(cookieValue);
  if (!payload) {
    const actorId = randomUUID();

    return {
      actorId,
      cookieValue: createSignedActorCookie(actorId, nowMs),
      shouldSetCookie: true,
      reason: "invalid",
    };
  }

  const ageSeconds = Math.floor(nowMs / 1000) - payload.issuedAt;
  if (ageSeconds >= ACTOR_COOKIE_REFRESH_AFTER_SECONDS) {
    return {
      actorId: payload.actorId,
      cookieValue: createSignedActorCookie(payload.actorId, nowMs),
      shouldSetCookie: true,
      reason: "refresh",
    };
  }

  return {
    actorId: payload.actorId,
    cookieValue,
    shouldSetCookie: false,
    reason: "valid",
  };
}

export function serializeActorCookie(
  cookieValue: string,
  options = getActorCookieOptions(),
): string {
  const parts = [
    `${ACTOR_COOKIE_NAME}=${cookieValue}`,
    `Max-Age=${options.maxAge}`,
    `Path=${options.path}`,
    `SameSite=${options.sameSite}`,
    "HttpOnly",
  ];

  if (options.secure) parts.push("Secure");

  return parts.join("; ");
}
