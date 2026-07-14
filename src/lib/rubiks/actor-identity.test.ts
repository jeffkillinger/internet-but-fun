import { describe, expect, it, vi } from "vitest";

import {
  ACTOR_COOKIE_MAX_AGE_SECONDS,
  ACTOR_COOKIE_NAME,
  ACTOR_COOKIE_REFRESH_AFTER_SECONDS,
  ActorIdentityError,
  createSignedActorCookie,
  getActorCookieOptions,
  isUuid,
  parseSignedActorCookie,
  resolveActorIdentity,
  serializeActorCookie,
} from "./actor-identity";

describe("anonymous actor identity", () => {
  it("creates a UUID actor when the cookie is missing", () => {
    vi.stubEnv("ACTOR_COOKIE_SECRET", "test-secret");

    const resolved = resolveActorIdentity(undefined, 1_000_000);

    expect(isUuid(resolved.actorId)).toBe(true);
    expect(resolved.shouldSetCookie).toBe(true);
    expect(resolved.reason).toBe("missing");
    expect(parseSignedActorCookie(resolved.cookieValue)?.actorId).toBe(
      resolved.actorId,
    );
  });

  it("resolves a valid cookie to the same actor without reissuing immediately", () => {
    vi.stubEnv("ACTOR_COOKIE_SECRET", "test-secret");
    const actorId = "11111111-1111-4111-8111-111111111111";
    const cookie = createSignedActorCookie(actorId, 1_000_000);

    expect(resolveActorIdentity(cookie, 1_001_000)).toEqual({
      actorId,
      cookieValue: cookie,
      shouldSetCookie: false,
      reason: "valid",
    });
  });

  it("replaces a tampered cookie", () => {
    vi.stubEnv("ACTOR_COOKIE_SECRET", "test-secret");
    const actorId = "11111111-1111-4111-8111-111111111111";
    const cookie = `${createSignedActorCookie(actorId, 1_000_000)}tampered`;

    const resolved = resolveActorIdentity(cookie, 1_001_000);

    expect(resolved.actorId).not.toBe(actorId);
    expect(isUuid(resolved.actorId)).toBe(true);
    expect(resolved.shouldSetCookie).toBe(true);
    expect(resolved.reason).toBe("invalid");
  });

  it("sets required cookie attributes for local development", () => {
    const options = getActorCookieOptions("development");
    const serialized = serializeActorCookie("value", options);

    expect(options).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: ACTOR_COOKIE_MAX_AGE_SECONDS,
    });
    expect(serialized).toContain(`${ACTOR_COOKIE_NAME}=value`);
    expect(serialized).toContain("HttpOnly");
    expect(serialized).toContain("SameSite=lax");
    expect(serialized).toContain(`Max-Age=${ACTOR_COOKIE_MAX_AGE_SECONDS}`);
    expect(serialized).not.toContain("Secure");
  });

  it("sets Secure in production", () => {
    const serialized = serializeActorCookie(
      "value",
      getActorCookieOptions("production"),
    );

    expect(serialized).toContain("Secure");
  });

  it("fails loudly and safely when the signing secret is missing", () => {
    vi.stubEnv("ACTOR_COOKIE_SECRET", "");

    expect(() => resolveActorIdentity(undefined)).toThrow(ActorIdentityError);
  });

  it("reissues the cookie when the refresh threshold is reached", () => {
    vi.stubEnv("ACTOR_COOKIE_SECRET", "test-secret");
    const actorId = "11111111-1111-4111-8111-111111111111";
    const cookie = createSignedActorCookie(actorId, 1_000_000);
    const nowMs =
      1_000_000 + ACTOR_COOKIE_REFRESH_AFTER_SECONDS * 1000 + 1000;

    const resolved = resolveActorIdentity(cookie, nowMs);

    expect(resolved.actorId).toBe(actorId);
    expect(resolved.cookieValue).not.toBe(cookie);
    expect(resolved.shouldSetCookie).toBe(true);
    expect(resolved.reason).toBe("refresh");
  });
});
