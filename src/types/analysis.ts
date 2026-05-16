import type {
  SleepAnalysisRequestPayload,
  SleepAnalysisResponsePayload
} from "../contracts/sleep.js";

export type SleepAnalysisRequest = SleepAnalysisRequestPayload;

export interface SleepAnalysisResult {
  summary: string;
  source: "openwhoop-cli" | "placeholder";
  details: Record<string, unknown>;
}

export type SleepAnalysisRouteResponse = SleepAnalysisResponsePayload;
