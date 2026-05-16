import { describe, expect, it } from "vitest";
import { createApp } from "../src/worker.js";

const app = createApp();

describe("worker routes", () => {
  it("returns health response with request id", async () => {
    const res = await app.request("http://localhost/health", undefined, {
      OPENWHOOP_ANALYSIS_URL: "",
      OPENWHOOP_ANALYSIS_API_KEY: "",
      BACKEND_API_KEY: "",
      RATE_LIMIT_MAX: "60",
      RATE_LIMIT_WINDOW_MS: "60000"
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; requestId: string };
    expect(json.ok).toBe(true);
    expect(typeof json.requestId).toBe("string");
    expect(json.requestId.length).toBeGreaterThan(0);
  });

  it("validates bad sleep request", async () => {
    const res = await app.request(
      "http://localhost/analysis/sleep",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dbPath: "" })
      },
      {
        OPENWHOOP_ANALYSIS_URL: "",
        OPENWHOOP_ANALYSIS_API_KEY: "",
        BACKEND_API_KEY: "",
        RATE_LIMIT_MAX: "60",
        RATE_LIMIT_WINDOW_MS: "60000"
      }
    );
    expect(res.status).toBe(400);
  });

  it("requires api key when configured", async () => {
    const res = await app.request(
      "http://localhost/analysis/sleep",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dbPath: "/tmp/test.db" })
      },
      {
        OPENWHOOP_ANALYSIS_URL: "",
        OPENWHOOP_ANALYSIS_API_KEY: "",
        BACKEND_API_KEY: "secret-key",
        RATE_LIMIT_MAX: "60",
        RATE_LIMIT_WINDOW_MS: "60000"
      }
    );
    expect(res.status).toBe(401);
  });

  it("returns mock upstream health", async () => {
    const res = await app.request(
      "http://localhost/analysis/upstream-health",
      undefined,
      {
        OPENWHOOP_ANALYSIS_URL: "",
        OPENWHOOP_ANALYSIS_API_KEY: "",
        BACKEND_API_KEY: "",
        RATE_LIMIT_MAX: "60",
        RATE_LIMIT_WINDOW_MS: "60000"
      }
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; mode: string };
    expect(json.ok).toBe(true);
    expect(json.mode).toBe("mock");
  });

  it("rate limits over threshold", async () => {
    const bindings = {
      OPENWHOOP_ANALYSIS_URL: "",
      OPENWHOOP_ANALYSIS_API_KEY: "",
      BACKEND_API_KEY: "",
      RATE_LIMIT_MAX: "2",
      RATE_LIMIT_WINDOW_MS: "60000"
    };

    await app.request(
      "http://localhost/analysis/upstream-health",
      undefined,
      bindings
    );
    await app.request(
      "http://localhost/analysis/upstream-health",
      undefined,
      bindings
    );
    const third = await app.request(
      "http://localhost/analysis/upstream-health",
      undefined,
      bindings
    );
    expect(third.status).toBe(429);
  });
});

