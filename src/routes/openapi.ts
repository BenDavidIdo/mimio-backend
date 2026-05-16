import { Hono } from "hono";

export function registerOpenApiRoute(app: Hono<any>): void {
  // SOURCE OF TRUTH: PublicApiSpecEndpoint
  // BOUNDARY: Exposes machine-readable API spec for client generation and integration checks.
  // INVARIANT: Contract docs match currently supported public routes.
  // FAILURE MODE: Static response; no runtime dependencies.
  app.get("/openapi.json", (c) =>
    c.json({
      openapi: "3.0.3",
      info: {
        title: "Mimo Backend API",
        version: "0.1.0"
      },
      paths: {
        "/health": {
          get: {
            summary: "Service health",
            responses: { "200": { description: "OK" } }
          }
        },
        "/analysis/upstream-health": {
          get: {
            summary: "Upstream analysis gateway health",
            security: [{ bearerAuth: [] }],
            responses: { "200": { description: "Gateway status" } }
          }
        },
        "/analysis/sleep": {
          post: {
            summary: "Analyze sleep window",
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["dbPath"],
                    properties: {
                      dbPath: { type: "string" },
                      startIso: { type: "string", format: "date-time" },
                      endIso: { type: "string", format: "date-time" }
                    }
                  }
                }
              }
            },
            responses: {
              "200": { description: "Sleep analysis response" },
              "400": { description: "Validation failure" },
              "401": { description: "Unauthorized" },
              "403": { description: "Forbidden" }
            }
          }
        }
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer"
          }
        }
      }
    })
  );
}
