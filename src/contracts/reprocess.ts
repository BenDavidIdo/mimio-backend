import { z } from "zod";

const isoTimestamp = z.string().datetime();

const scalarSample = z.object({
  time: isoTimestamp,
  value: z.number().finite()
});

const gravitySample = z.object({
  time: isoTimestamp,
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite()
});

// SOURCE OF TRUTH: HistoricalReprocessContract
// BOUNDARY: Contract for full-history cleanup payloads and responses.
// INVARIANT: Inputs are timestamped physiological samples; outputs are normalized timeline batches.
// FAILURE MODE: Invalid/missing payload fields are rejected at schema boundary.
export const reprocessHistoryRequestSchema = z
  .object({
    dbPath: z.string().min(1).optional(),
    startIso: isoTimestamp.optional(),
    endIso: isoTimestamp.optional(),
    heartRate: z.array(scalarSample).default([]),
    hrv: z.array(scalarSample).default([]),
    respiratoryRate: z.array(scalarSample).default([]),
    spo2: z.array(scalarSample).default([]),
    temperatureC: z.array(scalarSample).default([]),
    gravity: z.array(gravitySample).default([])
  })
  .refine(
    (value) =>
      Boolean(value.dbPath) ||
      value.heartRate.length > 0 ||
      value.hrv.length > 0 ||
      value.respiratoryRate.length > 0 ||
      value.spo2.length > 0 ||
      value.temperatureC.length > 0 ||
      value.gravity.length > 0,
    {
      message: "Provide dbPath or at least one non-empty sample series",
      path: ["dbPath"]
    }
  )
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

export const reprocessHistoryResponseSchema = z.object({
  summary: z.string(),
  source: z.string(),
  cleaned: z.object({
    heartRate: z.array(scalarSample),
    hrv: z.array(scalarSample),
    respiratoryRate: z.array(scalarSample),
    spo2: z.array(scalarSample),
    temperatureC: z.array(scalarSample),
    gravity: z.array(gravitySample)
  }),
  sleep: z
    .object({
      startIso: isoTimestamp,
      endIso: isoTimestamp,
      confidence: z.number().min(0).max(1),
      method: z.string(),
      stages: z
        .array(
          z.object({
            stage: z.enum(["awake", "light", "deep", "rem"]),
            startIso: isoTimestamp,
            endIso: isoTimestamp
          })
        )
        .default([])
    })
    .nullable(),
  stats: z.object({
    inputCounts: z.record(z.number().int().nonnegative()),
    outputCounts: z.record(z.number().int().nonnegative()),
    droppedCounts: z.record(z.number().int().nonnegative())
  })
});

export type ReprocessHistoryRequestPayload = z.infer<
  typeof reprocessHistoryRequestSchema
>;
export type ReprocessHistoryResponsePayload = z.infer<
  typeof reprocessHistoryResponseSchema
>;
