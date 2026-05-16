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

  it("returns analysis library catalog", async () => {
    const res = await app.request(
      "http://localhost/analysis/library-catalog",
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
    const json = (await res.json()) as {
      recommendedStack?: { sleep?: string[] };
      options?: Array<{ id: string }>;
    };
    expect(json.recommendedStack?.sleep).toBeTruthy();
    expect(json.options?.some((x) => x.id === "asleep")).toBe(true);
  });

  it("reprocesses historical series and returns cleaned payload", async () => {
    const res = await app.request(
      "http://localhost/analysis/reprocess-history",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          heartRate: [
            { time: "2026-05-16T00:00:00Z", value: 65 },
            { time: "2026-05-16T00:00:10Z", value: 66 },
            { time: "2026-05-16T00:00:20Z", value: 250 }
          ],
          gravity: [
            { time: "2026-05-16T00:00:00Z", x: 0.0, y: 0.0, z: 1.0 },
            { time: "2026-05-16T00:00:10Z", x: 0.001, y: 0.0, z: 1.001 },
            { time: "2026-05-16T00:00:20Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:00:30Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:00:40Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:00:50Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:01:00Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:01:10Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:01:20Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:01:30Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:01:40Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:01:50Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:02:00Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:02:10Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:02:20Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:02:30Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:02:40Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:02:50Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:03:00Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:03:10Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:03:20Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:03:30Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:03:40Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:03:50Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:04:00Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:04:10Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:04:20Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:04:30Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:04:40Z", x: 0.001, y: 0.001, z: 1.0 },
            { time: "2026-05-16T00:04:50Z", x: 0.001, y: 0.001, z: 1.0 }
          ]
        })
      },
      {
        OPENWHOOP_ANALYSIS_URL: "",
        OPENWHOOP_ANALYSIS_API_KEY: "",
        BACKEND_API_KEY: "",
        RATE_LIMIT_MAX: "60",
        RATE_LIMIT_WINDOW_MS: "60000"
      }
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      cleaned?: { heartRate?: unknown[] };
      stats?: { droppedCounts?: { heartRate?: number } };
      requestId?: string;
    };
    expect(json.cleaned?.heartRate?.length).toBe(2);
    expect(json.stats?.droppedCounts?.heartRate).toBe(1);
    expect(typeof json.requestId).toBe("string");
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

  it("uses service binding for upstream health when provided", async () => {
    const res = await app.request(
      "http://localhost/analysis/upstream-health",
      undefined,
      {
        OPENWHOOP_ANALYSIS_URL: "",
        OPENWHOOP_ANALYSIS_API_KEY: "",
        BACKEND_API_KEY: "",
        RATE_LIMIT_MAX: "60",
        RATE_LIMIT_WINDOW_MS: "60000",
        UPSTREAM_ANALYSIS: {
          fetch: async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith("/health")) {
              return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { "content-type": "application/json" }
              });
            }
            return new Response("not found", { status: 404 });
          }
        }
      }
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      mode: string;
      upstreamStatus: number;
    };
    expect(json.ok).toBe(true);
    expect(json.mode).toBe("upstream");
    expect(json.upstreamStatus).toBe(200);
  });

  it("prefers OPENWHOOP_ANALYSIS_URL over service binding when both exist", async () => {
    const res = await app.request(
      "http://localhost/analysis/upstream-health",
      undefined,
      {
        OPENWHOOP_ANALYSIS_URL: "https://example.com",
        OPENWHOOP_ANALYSIS_API_KEY: "",
        BACKEND_API_KEY: "",
        RATE_LIMIT_MAX: "60",
        RATE_LIMIT_WINDOW_MS: "60000",
        UPSTREAM_ANALYSIS: {
          fetch: async () =>
            new Response(JSON.stringify({ ok: true }), {
              status: 200,
              headers: { "content-type": "application/json" }
            })
        }
      }
    );

    // URL gateway hits example.com/health which should not be 200 in test env.
    // If service binding was incorrectly prioritized this would be 200.
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      mode: string;
      debug?: { gateway?: string };
    };
    expect(json.mode).toBe("upstream");
    expect(json.debug?.gateway).toBe("http");
  });
});
