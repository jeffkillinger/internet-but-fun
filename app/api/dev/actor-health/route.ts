import {
  ACTOR_COOKIE_NAME,
  ActorIdentityError,
  isUuid,
  parseSignedActorCookie,
  resolveActorIdentity,
  serializeActorCookie,
} from "../../../../src/lib/rubiks/actor-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readActorCookie(request: Request): string | undefined {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ACTOR_COOKIE_NAME}=`))
    ?.slice(ACTOR_COOKIE_NAME.length + 1);
}

function redactedActorId(actorId: string): string {
  return `${actorId.slice(0, 8)}...${actorId.slice(-4)}`;
}

export async function GET(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return Response.json(
      {
        error: {
          code: "dev_endpoint_disabled",
          message: "This endpoint is disabled in production.",
        },
      },
      { status: 404 },
    );
  }

  try {
    const cookieValue = readActorCookie(request);
    const parsedCookie = cookieValue ? parseSignedActorCookie(cookieValue) : null;
    const identity = resolveActorIdentity(cookieValue);
    const response = Response.json({
      ok: true,
      actorCookiePresent: Boolean(cookieValue),
      signatureValid: Boolean(parsedCookie),
      uuidFormatValid: isUuid(identity.actorId),
      actorPreview: redactedActorId(identity.actorId),
      cookieSet: identity.shouldSetCookie,
      reason: identity.reason,
    });

    if (identity.shouldSetCookie) {
      response.headers.append(
        "Set-Cookie",
        serializeActorCookie(identity.cookieValue),
      );
    }

    return response;
  } catch (error) {
    if (error instanceof ActorIdentityError) {
      return Response.json(
        {
          ok: false,
          error: {
            code: "identity_unavailable",
            message: "Actor identity is unavailable.",
          },
        },
        { status: 500 },
      );
    }

    return Response.json(
      {
        ok: false,
        error: {
          code: "actor_health_failed",
          message: "Actor health check failed.",
        },
      },
      { status: 500 },
    );
  }
}
