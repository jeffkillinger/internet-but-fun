import type { GameId, JoinGameRequest } from "../../../../src/lib/api/types";
import {
  ACTOR_COOKIE_NAME,
  ActorIdentityError,
  resolveActorIdentity,
  serializeActorCookie,
} from "../../../../src/lib/rubiks/actor-identity";
import { submitJoin } from "../../../../src/lib/rubiks/join";
import { PublicApiError } from "../../../../src/lib/rubiks/status";
import { TurnTokenError } from "../../../../src/lib/rubiks/turns";

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

function turnTokenErrorResponse(): Response {
  return Response.json(
    {
      error: {
        code: "turn_token_unavailable",
        message: "Turn credentials are unavailable.",
      },
    },
    { status: 500 },
  );
}

function invalidRequestResponse(message: string): Response {
  return errorResponse(new PublicApiError("invalid_request", message, 400));
}

function readActorCookie(request: Request): string | undefined {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ACTOR_COOKIE_NAME}=`))
    ?.slice(ACTOR_COOKIE_NAME.length + 1);
}

export async function POST(request: Request): Promise<Response> {
  let body: Partial<JoinGameRequest>;

  try {
    body = (await request.json()) as Partial<JoinGameRequest>;
  } catch {
    return invalidRequestResponse("Request body must be JSON.");
  }

  if (typeof body !== "object" || body === null) {
    return invalidRequestResponse("Request body must be a JSON object.");
  }

  const gameId = body.gameId as GameId | undefined;
  const epochId = body.epochId;

  if (gameId !== "rubiks-cube") {
    return invalidRequestResponse("Join requires gameId=rubiks-cube.");
  }

  if (typeof epochId !== "string") {
    return invalidRequestResponse("epochId is required.");
  }

  try {
    const identity = resolveActorIdentity(readActorCookie(request));
    const response = Response.json(
      await submitJoin({ gameId, epochId, actorId: identity.actorId }),
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

    if (error instanceof TurnTokenError) {
      return turnTokenErrorResponse();
    }

    if (error instanceof PublicApiError) {
      return errorResponse(error);
    }

    return errorResponse(
      new PublicApiError("database_unavailable", "Database is unavailable.", 503),
    );
  }
}
