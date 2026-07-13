import type { GameId } from "@/src/lib/api/types";
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

    return Response.json(await getStatusFullResponse(gameId as GameId));
  } catch (error) {
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
