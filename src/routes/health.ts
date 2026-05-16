import { Hono } from "hono";

export function registerHealthRoute(app: Hono<any>): void {
  app.get("/health", (c) =>
    c.json({
      ok: true,
      service: "mimo-backend-cloudflare",
      requestId: c.get("requestId")
    })
  );
}
