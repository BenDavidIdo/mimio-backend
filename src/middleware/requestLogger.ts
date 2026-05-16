import type { MiddlewareHandler } from "hono";
import type { WorkerBindings } from "../config/env.js";
import type { RequestContextVariables } from "./requestContext.js";

type LoggerEnv = { Bindings: WorkerBindings; Variables: RequestContextVariables };

export const requestLoggerMiddleware: MiddlewareHandler<LoggerEnv> = async (c, next) => {
  const started = Date.now();
  await next();
  const durationMs = Date.now() - started;
  const log = {
    msg: "http_request",
    requestId: c.get("requestId"),
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs
  };
  console.log(JSON.stringify(log));
};

