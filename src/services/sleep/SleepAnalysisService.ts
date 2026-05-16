import type { SleepAnalysisRequest, SleepAnalysisResult } from "../../types/analysis.js";
import type { OpenWhoopAnalysisGateway } from "../openwhoop/OpenWhoopAnalysisGateway.js";

export class SleepAnalysisService {
  // SOURCE OF TRUTH: SleepAnalysisOrchestration
  // BOUNDARY: Maps backend sleep-analysis requests to OpenWhoop-backed execution.
  // INVARIANT: Service returns stable JSON shape regardless of analysis backend details.
  // FAILURE MODE: Returns actionable error to route layer; route maps to non-200 response.
  constructor(private readonly gateway: OpenWhoopAnalysisGateway) {}

  async analyze(req: SleepAnalysisRequest): Promise<SleepAnalysisResult> {
    const upstream = await this.gateway.analyzeSleep(req);
    return {
      summary: upstream.summary,
      source: upstream.source === "mock" ? "placeholder" : "openwhoop-cli",
      details: upstream.details
    };
  }
}
