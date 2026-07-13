import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

let sql: postgres.Sql | null = null;

export function getDatabaseUrl(): string {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return databaseUrl;
}

export function getDatabasePort(): string | null {
  const url = getDatabaseUrl();

  try {
    return new URL(url).port || null;
  } catch {
    return null;
  }
}

export function usesSupabaseTransactionPoolerPort(): boolean {
  return getDatabasePort() === "6543";
}

export function getSql(): postgres.Sql {
  if (!sql) {
    sql = postgres(getDatabaseUrl(), {
      max: 5,
      prepare: false,
      ssl: "require",
    });
  }

  return sql;
}

export async function closeSql(): Promise<void> {
  if (!sql) return;

  const active = sql;
  sql = null;
  await active.end();
}
