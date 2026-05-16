import type { MiddlewareHandler } from "hono";

export type RequestContextVariables = {
  requestId: string;
};

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const requestContextMiddleware: MiddlewareHandler = async (c, next) => {
  // SOURCE OF TRUTH: ApiRequestContext
  // BOUNDARY: Adds request correlation metadata to every API response and log scope.
  // INVARIANT: Every request has a stable requestId for tracing.
  // FAILURE MODE: Falls back to crypto.randomUUID when caller ID is absent/invalid.
  const incoming = c.req.header("x-request-id");
  const requestId =
    incoming && uuidRegex.test(incoming) ? incoming : crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("x-request-id", requestId);
  await next();
};
