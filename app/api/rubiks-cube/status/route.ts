import type { GameId } from "@/src/lib/api/types";
import {
  ACTOR_COOKIE_NAME,
  ActorIdentityError,
  resolveActorIdentity,
  serializeActorCookie,
} from "@/src/lib/rubiks/actor-identity";
import {
  getStatusFullResponse,
  PublicApiError,
} from "@/src/lib/rubiks/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: PublicApiError): Response {
  return Response.json(
    {
      error: {
        code: error.code,
        message: error.message,
      },
    },
    { status: error.status },
  );
}

function identityErrorResponse(): Response {
  return Response.json(
    {
      error: {
        code: "identity_unavailable",
        message: "Actor identity is unavailable.",
      },
    },
    { status: 500 },
  );
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("gameId");

  try {
    if (gameId !== "rubiks-cube") {
      throw new PublicApiError(
        "invalid_request",
        "StatusFull requires gameId=rubiks-cube.",
        400,
      );
    }

    const actorCookie = request.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${ACTOR_COOKIE_NAME}=`))
      ?.slice(ACTOR_COOKIE_NAME.length + 1);
    const identity = resolveActorIdentity(actorCookie);
    const response = Response.json(
      await getStatusFullResponse(gameId as GameId, identity.actorId),
    );

    if (identity.shouldSetCookie) {
      response.headers.append(
        "Set-Cookie",
        serializeActorCookie(identity.cookieValue),
      );
    }

    return response;
  } catch (error) {
    if (error instanceof ActorIdentityError) {
      return identityErrorResponse();
    }

    if (error instanceof PublicApiError) {
      return errorResponse(error);
    }

    return errorResponse(
      new PublicApiError(
        "database_unavailable",
        "Database is unavailable.",
        503,
      ),
    );
  }
}
