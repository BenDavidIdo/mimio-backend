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
        "/analysis/library-catalog": {
          get: {
            summary: "List candidate analysis libraries and recommended stack",
            security: [{ bearerAuth: [] }],
            responses: { "200": { description: "Library catalog" } }
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
        },
        "/analysis/clean-window": {
          post: {
            summary: "Clean realtime metrics for a batched window",
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["samples"],
                    properties: {
                      samples: {
                        type: "array",
                        items: {
                          type: "object",
                          required: ["time"],
                          properties: {
                            time: { type: "string", format: "date-time" },
                            heartRateBPM: { type: "number" },
                            hrvMs: { type: "number" },
                            restingHeartRateBPM: { type: "number" },
                            respiratoryRatePerMin: { type: "number" },
                            oxygenSaturationFraction: { type: "number" },
                            bodyTemperatureCelsius: { type: "number" }
                          }
                        }
                      },
                      windowStartIso: { type: "string", format: "date-time" },
                      windowEndIso: { type: "string", format: "date-time" }
                    }
                  }
                }
              }
            },
            responses: {
              "200": { description: "Cleaned realtime metrics response" },
              "400": { description: "Validation failure" },
              "401": { description: "Unauthorized" },
              "403": { description: "Forbidden" }
            }
          }
        },
        "/analysis/reprocess-history": {
          post: {
            summary: "Reprocess historical decoded samples and infer sleep session",
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      dbPath: { type: "string" },
                      startIso: { type: "string", format: "date-time" },
                      endIso: { type: "string", format: "date-time" },
                      heartRate: {
                        type: "array",
                        items: {
                          type: "object",
                          required: ["time", "value"],
                          properties: {
                            time: { type: "string", format: "date-time" },
                            value: { type: "number" }
                          }
                        }
                      },
                      hrv: {
                        type: "array",
                        items: {
                          type: "object",
                          required: ["time", "value"],
                          properties: {
                            time: { type: "string", format: "date-time" },
                            value: { type: "number" }
                          }
                        }
                      },
                      respiratoryRate: {
                        type: "array",
                        items: {
                          type: "object",
                          required: ["time", "value"],
                          properties: {
                            time: { type: "string", format: "date-time" },
                            value: { type: "number" }
                          }
                        }
                      },
                      spo2: {
                        type: "array",
                        items: {
                          type: "object",
                          required: ["time", "value"],
                          properties: {
                            time: { type: "string", format: "date-time" },
                            value: { type: "number" }
                          }
                        }
                      },
                      temperatureC: {
                        type: "array",
                        items: {
                          type: "object",
                          required: ["time", "value"],
                          properties: {
                            time: { type: "string", format: "date-time" },
                            value: { type: "number" }
                          }
                        }
                      },
                      gravity: {
                        type: "array",
                        items: {
                          type: "object",
                          required: ["time", "x", "y", "z"],
                          properties: {
                            time: { type: "string", format: "date-time" },
                            x: { type: "number" },
                            y: { type: "number" },
                            z: { type: "number" }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            responses: {
              "200": { description: "Reprocess output (cleaned series + sleep candidate)" },
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
