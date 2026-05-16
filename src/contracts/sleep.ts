import { z } from "zod";

// SOURCE OF TRUTH: SleepAnalysisApiContract
// BOUNDARY: Shared request/response contract for sleep analysis endpoints.
// INVARIANT: Route handlers and clients use the same schema shape for compatibility.
// FAILURE MODE: Invalid payloads fail fast at request boundary with structured validation errors.
export const sleepAnalysisRequestSchema = z
  .object({
    dbPath: z.string().min(1),
    startIso: z.string().datetime().optional(),
    endIso: z.string().datetime().optional()
  })
  .refine(
    (value) => {
      if (!value.startIso || !value.endIso) return true;
      return Date.parse(value.startIso) <= Date.parse(value.endIso);
    },
    {
      message: "startIso must be earlier than or equal to endIso",
      path: ["startIso"]
    }
  );

export const sleepAnalysisResponseSchema = z.object({
  summary: z.string(),
  source: z.enum(["openwhoop-cli", "placeholder"]),
  details: z.record(z.unknown()),
  requestId: z.string().uuid()
});

export type SleepAnalysisRequestPayload = z.infer<typeof sleepAnalysisRequestSchema>;
export type SleepAnalysisResponsePayload = z.infer<typeof sleepAnalysisResponseSchema>;
