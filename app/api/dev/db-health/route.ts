import { getDbHealth } from "@/src/lib/rubiks/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
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
    return Response.json(await getDbHealth());
  } catch {
    return Response.json(
      {
        ok: false,
        connection: "failed",
        expectedTablesPresent: false,
        missingTables: [],
        activeEpochExists: false,
        activeEpochId: null,
        cubeVersion: null,
        pooledPort6543: false,
      },
      { status: 503 },
    );
  }
}
