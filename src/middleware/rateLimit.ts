import type { MiddlewareHandler } from "hono";
import { parseBindings, type WorkerBindings } from "../config/env.js";
import type { RequestContextVariables } from "./requestContext.js";

type RateLimitEnv = { Bindings: WorkerBindings; Variables: RequestContextVariables };

type WindowState = {
  windowStart: number;
  count: number;
};

const bucket = new Map<string, WindowState>();

export const rateLimitMiddleware: MiddlewareHandler<RateLimitEnv> = async (c, next) => {
  // SOURCE OF TRUTH: AnalysisRouteRateLimit
  // BOUNDARY: Rate-limits analysis endpoints per client IP within a fixed window.
  // INVARIANT: At most RATE_LIMIT_MAX requests per RATE_LIMIT_WINDOW_MS per key.
  // FAILURE MODE: Returns 429 with retry metadata; does not execute downstream handlers.
  const { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } = parseBindings(c.env);
  const now = Date.now();
  const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";
  const key = `${ip}:${c.req.path}`;
  const state = bucket.get(key);

  if (!state || now - state.windowStart >= RATE_LIMIT_WINDOW_MS) {
    bucket.set(key, { windowStart: now, count: 1 });
  } else {
    state.count += 1;
    if (state.count > RATE_LIMIT_MAX) {
      const resetInMs = RATE_LIMIT_WINDOW_MS - (now - state.windowStart);
      c.header("retry-after", `${Math.ceil(resetInMs / 1000)}`);
      return c.json(
        {
          error: "rate_limited",
          message: "Too many requests",
          requestId: c.get("requestId"),
          resetInMs
        },
        429
      );
    }
  }

  await next();
};

