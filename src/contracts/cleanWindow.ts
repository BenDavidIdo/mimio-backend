import { z } from "zod";

// SOURCE OF TRUTH: RealtimeCleanWindowApiContract
// BOUNDARY: Contract for 15-minute realtime metric cleanup before HealthKit persistence.
// INVARIANT: Time-ordered metrics in, cleaned time-ordered metrics out.
// FAILURE MODE: Invalid payloads are rejected at boundary with structured errors.
export const cleanWindowSampleSchema = z.object({
  time: z.string().datetime(),
  heartRateBPM: z.number().optional(),
  hrvMs: z.number().optional(),
  restingHeartRateBPM: z.number().optional(),
  respiratoryRatePerMin: z.number().optional(),
  oxygenSaturationFraction: z.number().optional(),
  bodyTemperatureCelsius: z.number().optional()
});

export const cleanWindowRequestSchema = z.object({
  samples: z.array(cleanWindowSampleSchema).min(1),
  windowStartIso: z.string().datetime().optional(),
  windowEndIso: z.string().datetime().optional()
});

export const cleanWindowResponseSchema = z.object({
  summary: z.string(),
  source: z.enum(["backend-cleaner"]),
  inputSamples: z.number(),
  outputSamples: z.number(),
  droppedFields: z.number(),
  samples: z.array(cleanWindowSampleSchema),
  requestId: z.string().uuid()
});

export type CleanWindowRequestPayload = z.infer<typeof cleanWindowRequestSchema>;
export type CleanWindowSamplePayload = z.infer<typeof cleanWindowSampleSchema>;
export type CleanWindowResponsePayload = z.infer<typeof cleanWindowResponseSchema>;
