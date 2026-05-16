import type { MiddlewareHandler } from "hono";
import { parseBindings, type WorkerBindings } from "../config/env.js";
import type { RequestContextVariables } from "./requestContext.js";

type AuthEnv = { Bindings: WorkerBindings; Variables: RequestContextVariables };

export const apiKeyAuthMiddleware: MiddlewareHandler<AuthEnv> = async (c, next) => {
  // SOURCE OF TRUTH: BackendApiAuth
  // BOUNDARY: Guards non-public routes with backend API key validation.
  // INVARIANT: If BACKEND_API_KEY is configured, protected routes require matching bearer token.
  // FAILURE MODE: Returns 401/403 JSON and never falls through on failed auth.
  const bindings = parseBindings(c.env);
  if (!bindings.BACKEND_API_KEY) {
    await next();
    return;
  }

  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      {
        error: "unauthorized",
        message: "Missing bearer token",
        requestId: c.get("requestId")
      },
      401
    );
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (token !== bindings.BACKEND_API_KEY) {
    return c.json(
      {
        error: "forbidden",
        message: "Invalid API key",
        requestId: c.get("requestId")
      },
      403
    );
  }

  await next();
};
