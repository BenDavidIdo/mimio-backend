import { z } from "zod";

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const bindingSchema = z.object({
  OPENWHOOP_ANALYSIS_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  OPENWHOOP_ANALYSIS_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  BACKEND_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60)
});

export type WorkerBindings = {
  UPSTREAM_ANALYSIS?: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  };
  OPENWHOOP_ANALYSIS_URL?: string;
  OPENWHOOP_ANALYSIS_API_KEY?: string;
  BACKEND_API_KEY?: string;
  RATE_LIMIT_WINDOW_MS?: string;
  RATE_LIMIT_MAX?: string;
};

export function parseBindings(bindings: WorkerBindings): z.infer<typeof bindingSchema> {
  return bindingSchema.parse(bindings);
}
