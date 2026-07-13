import { getSql, usesSupabaseTransactionPoolerPort } from "../db/client";

export type DbHealthResponse = {
  ok: boolean;
  connection: "ok";
  expectedTablesPresent: boolean;
  missingTables: string[];
  activeEpochExists: boolean;
  activeEpochId: string | null;
  cubeVersion: number | null;
  pooledPort6543: boolean;
};

const EXPECTED_TABLES = [
  "actor_claims",
  "epochs",
  "events",
  "queue_entries",
  "turns",
] as const;

type TableRow = {
  table_name: string;
};

type ActiveEpochRow = {
  id: string;
  cube_version: number;
};

export async function getDbHealth(): Promise<DbHealthResponse> {
  const sql = getSql();
  await sql`select 1`;

  const tableRows = await sql<TableRow[]>`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name = any(${EXPECTED_TABLES})
  `;
  const present = new Set(tableRows.map((row) => row.table_name));
  const missingTables = EXPECTED_TABLES.filter((table) => !present.has(table));
  const [activeEpoch] = await sql<ActiveEpochRow[]>`
    select id::text, cube_version
    from epochs
    where game_id = 'rubiks-cube' and status = 'active'
    order by started_at desc
    limit 1
  `;

  return {
    ok: missingTables.length === 0 && Boolean(activeEpoch),
    connection: "ok",
    expectedTablesPresent: missingTables.length === 0,
    missingTables,
    activeEpochExists: Boolean(activeEpoch),
    activeEpochId: activeEpoch?.id ?? null,
    cubeVersion: activeEpoch?.cube_version ?? null,
    pooledPort6543: usesSupabaseTransactionPoolerPort(),
  };
}
