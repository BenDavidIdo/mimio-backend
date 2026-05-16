import { Hono } from "hono";
import type { WorkerBindings } from "../config/env.js";
import type { SleepAnalysisService } from "../services/sleep/SleepAnalysisService.js";
import type { RequestContextVariables } from "../middleware/requestContext.js";
import { sleepAnalysisRequestSchema } from "../contracts/sleep.js";

export function registerAnalysisRoutes(
  app: Hono<{ Bindings: WorkerBindings; Variables: RequestContextVariables }>,
  getSleepService: (bindings: WorkerBindings) => SleepAnalysisService,
  getGateway: (bindings: WorkerBindings) => {
    ping: () => Promise<{
      ok: boolean;
      mode: "mock" | "upstream";
      latencyMs?: number;
      upstreamStatus?: number;
    }>;
    debugInfo?: () => Record<string, unknown>;
  }
): void {
  app.get("/analysis/upstream-health", async (c) => {
    const gateway = getGateway(c.env);
    const result = await gateway.ping();
    return c.json({
      ...result,
      debug: gateway.debugInfo?.() ?? null,
      requestId: c.get("requestId")
    });
  });

  app.post("/analysis/sleep", async (c) => {
    const json = await c.req.json().catch(() => null);
    const parsed = sleepAnalysisRequestSchema.safeParse(json);
    if (!parsed.success) {
      return c.json(
        {
          error: "invalid_request",
          details: parsed.error.flatten(),
          requestId: c.get("requestId")
        },
        400
      );
    }
    const result = await getSleepService(c.env).analyze(parsed.data);
    return c.json({
      ...result,
      requestId: c.get("requestId")
    });
  });
}
