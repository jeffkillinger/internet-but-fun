import { describe, expect, it, vi } from "vitest";

describe("dev actor health route", () => {
  it("is disabled in production", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ACTOR_COOKIE_SECRET", "test-secret");

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/dev/actor-health"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: {
        code: "dev_endpoint_disabled",
        message: "This endpoint is disabled in production.",
      },
    });
  });

  it("does not expose the full actor id", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ACTOR_COOKIE_SECRET", "test-secret");

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/dev/actor-health"));
    const body = await response.json();
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.actorPreview).toMatch(/^[0-9a-f]{8}\.\.\.[0-9a-f]{4}$/);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).not.toContain(body.actorPreview.replace("...", ""));
  });
});
