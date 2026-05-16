import { Hono } from "hono";
import { parseBindings, type WorkerBindings } from "./config/env.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerAnalysisRoutes } from "./routes/analysis.js";
import { registerOpenApiRoute } from "./routes/openapi.js";
import {
  HttpOpenWhoopAnalysisGateway,
  MockOpenWhoopAnalysisGateway,
  type OpenWhoopAnalysisGateway
} from "./services/openwhoop/OpenWhoopAnalysisGateway.js";
import { SleepAnalysisService } from "./services/sleep/SleepAnalysisService.js";
import {
  requestContextMiddleware,
  type RequestContextVariables
} from "./middleware/requestContext.js";
import { apiKeyAuthMiddleware } from "./middleware/apiKeyAuth.js";
import { rateLimitMiddleware } from "./middleware/rateLimit.js";
import { requestLoggerMiddleware } from "./middleware/requestLogger.js";

export type Env = {
  Bindings: WorkerBindings;
  Variables: RequestContextVariables;
};

export function createApp(): Hono<Env> {
  const app = new Hono<Env>();

// SOURCE OF TRUTH: CloudflareWorkerApi
// BOUNDARY: Public API surface for Mimo backend on Cloudflare Workers.
// INVARIANT: All analysis routes are mediated via service boundaries.
// FAILURE MODE: Returns structured JSON errors without leaking internals.
  app.get("/", (c) =>
    c.json({
      name: "mimo-backend",
      runtime: "cloudflare-workers",
      routes: [
        "/health",
        "/openapi.json",
        "/analysis/upstream-health",
        "/analysis/sleep"
      ]
    })
  );

  app.use("*", requestContextMiddleware);
  app.use("*", requestLoggerMiddleware);
  registerHealthRoute(app);
  registerOpenApiRoute(app);
  app.use("/analysis/*", apiKeyAuthMiddleware);
  app.use("/analysis/*", rateLimitMiddleware);
  const buildGateway = (workerBindings: WorkerBindings): OpenWhoopAnalysisGateway => {
    const bindings = parseBindings(workerBindings);
    return bindings.OPENWHOOP_ANALYSIS_URL
      ? new HttpOpenWhoopAnalysisGateway(
          bindings.OPENWHOOP_ANALYSIS_URL,
          bindings.OPENWHOOP_ANALYSIS_API_KEY
        )
      : new MockOpenWhoopAnalysisGateway();
  };

  registerAnalysisRoutes(
    app,
    (workerBindings) => new SleepAnalysisService(buildGateway(workerBindings)),
    buildGateway
  );

  app.onError((error, c) => {
    return c.json(
      {
        error: "internal_error",
        message: error.message,
        requestId: c.get("requestId")
      },
      500
    );
  });

  return app;
}

const app = createApp();
export default app;
