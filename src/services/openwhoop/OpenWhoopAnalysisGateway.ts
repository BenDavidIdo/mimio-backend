import { z } from "zod";

const upstreamRequestSchema = z.object({
  dbPath: z.string().min(1),
  startIso: z.string().datetime().nullable(),
  endIso: z.string().datetime().nullable()
});

const upstreamSleepResponseSchema = z.object({
  summary: z.string(),
  source: z.string(),
  details: z.record(z.unknown())
});

export interface OpenWhoopSleepResponse {
  summary: string;
  source: string;
  details: Record<string, unknown>;
}

export interface OpenWhoopAnalysisGateway {
  ping(): Promise<{
    ok: boolean;
    mode: "mock" | "upstream";
    latencyMs?: number;
    upstreamStatus?: number;
  }>;
  analyzeSleep(input: {
    dbPath: string;
    startIso?: string;
    endIso?: string;
  }): Promise<OpenWhoopSleepResponse>;
}

export class MockOpenWhoopAnalysisGateway implements OpenWhoopAnalysisGateway {
  // SOURCE OF TRUTH: CloudflareMockOpenWhoopGateway
  // BOUNDARY: Dev-safe analysis adapter when no upstream Rust service is configured.
  // INVARIANT: Response contract matches production gateway shape.
  // FAILURE MODE: Never throws for valid input; emits deterministic placeholder output.
  async ping(): Promise<{
    ok: boolean;
    mode: "mock";
  }> {
    return { ok: true, mode: "mock" };
  }

  async analyzeSleep(input: {
    dbPath: string;
    startIso?: string;
    endIso?: string;
  }): Promise<OpenWhoopSleepResponse> {
    return {
      summary: "Mock analysis active. Set OPENWHOOP_ANALYSIS_URL to use real upstream.",
      source: "mock",
      details: {
        dbPath: input.dbPath,
        startIso: input.startIso ?? null,
        endIso: input.endIso ?? null
      }
    };
  }
}

export class HttpOpenWhoopAnalysisGateway implements OpenWhoopAnalysisGateway {
  // SOURCE OF TRUTH: OpenWhoopUpstreamGateway
  // BOUNDARY: Cloudflare worker talks to upstream Rust/Python analytics via HTTP.
  // INVARIANT: Worker never executes local binaries or shell commands.
  // FAILURE MODE: Throws with status/body context when upstream fails.
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string
  ) {
    this.baseUrl = this.normalizeBaseUrl(baseUrl);
  }

  async ping(): Promise<{
    ok: boolean;
    mode: "upstream";
    latencyMs?: number;
    upstreamStatus?: number;
  }> {
    const started = Date.now();
    const response = await this.fetchWithRetry(this.endpointUrl("/health"), {
      method: "GET"
    });
    return {
      ok: response.ok,
      mode: "upstream",
      latencyMs: Date.now() - started,
      upstreamStatus: response.status
    };
  }

  async analyzeSleep(input: {
    dbPath: string;
    startIso?: string;
    endIso?: string;
  }): Promise<OpenWhoopSleepResponse> {
    const payload = upstreamRequestSchema.parse({
      dbPath: input.dbPath,
      startIso: input.startIso ?? null,
      endIso: input.endIso ?? null
    });

    const response = await this.fetchWithRetry(
      this.endpointUrl("/analysis/sleep"),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {})
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Upstream analysis failed (${response.status}): ${body}`);
    }

    const body = await response.json().catch(() => null);
    const parsed = upstreamSleepResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new Error("Upstream analysis response schema mismatch");
    }
    return parsed.data;
  }

  private async fetchWithRetry(
    url: string,
    init: RequestInit
  ): Promise<Response> {
    let lastError: unknown;
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetch(url, {
          ...init,
          signal: controller.signal
        });
        if (response.status >= 500 && attempt < maxAttempts) {
          await this.wait(attempt * 300);
          continue;
        }
        return response;
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          await this.wait(attempt * 300);
          continue;
        }
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error(
      `Upstream request failed after retries: ${
        lastError instanceof Error ? lastError.message : "unknown error"
      }`
    );
  }

  private async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private normalizeBaseUrl(raw: string): string {
    const trimmed = raw.trim();
    // Accept full URLs with any path/query and normalize to origin only.
    // This makes OPENWHOOP_ANALYSIS_URL robust to dashboard copy/paste mistakes.
    try {
      return new URL(trimmed).origin;
    } catch {
      // Fall back to conservative normalization if URL parsing fails.
      return trimmed.replace(/\/+$/, "").replace(/\/analysis\/sleep$/i, "");
    }
  }

  private endpointUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }
}
