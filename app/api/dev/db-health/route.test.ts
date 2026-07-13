import { describe, expect, it, vi } from "vitest";

describe("dev database health route", () => {
  it("exposes no secrets in the failure response", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", "postgres://user:secret@example.com:6543/db");
    vi.doMock("@/src/lib/rubiks/health", () => ({
      getDbHealth: vi.fn().mockRejectedValue(new Error("secret raw database error")),
    }));

    const { GET } = await import("./route");
    const response = await GET();
    const text = await response.text();

    expect(text).not.toContain("secret");
    expect(text).not.toContain("postgres://");
    expect(text).not.toContain("DATABASE_URL");
  });

  it("is disabled in production", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.doMock("@/src/lib/rubiks/health", () => ({
      getDbHealth: vi.fn().mockRejectedValue(new Error("should not be called")),
    }));

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: {
        code: "dev_endpoint_disabled",
        message: "This endpoint is disabled in production.",
      },
    });
  });
});
