import { z } from "zod";

const upstreamRequestSchema = z.object({
  dbPath: z.string().min(1).optional(),
  gravitySamples: z
    .array(
      z.object({
        time: z.string().datetime(),
        x: z.number(),
        y: z.number(),
        z: z.number()
      })
    )
    .optional(),
  startIso: z.string().datetime().nullable(),
  endIso: z.string().datetime().nullable()
}).refine(
  (value) => Boolean(value.dbPath) || Boolean(value.gravitySamples?.length),
  { message: "Either dbPath or gravitySamples is required", path: ["dbPath"] }
);

const upstreamReprocessRequestSchema = z
  .object({
    dbPath: z.string().min(1).optional(),
    startIso: z.string().datetime().nullable().optional(),
    endIso: z.string().datetime().nullable().optional(),
    heartRate: z
      .array(z.object({ time: z.string().datetime(), value: z.number() }))
      .default([]),
    hrv: z
      .array(z.object({ time: z.string().datetime(), value: z.number() }))
      .default([]),
    respiratoryRate: z
      .array(z.object({ time: z.string().datetime(), value: z.number() }))
      .default([]),
    spo2: z
      .array(z.object({ time: z.string().datetime(), value: z.number() }))
      .default([]),
    temperatureC: z
      .array(z.object({ time: z.string().datetime(), value: z.number() }))
      .default([]),
    gravity: z
      .array(
        z.object({
          time: z.string().datetime(),
          x: z.number(),
          y: z.number(),
          z: z.number()
        })
      )
      .default([])
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
    { message: "Provide dbPath or at least one sample series", path: ["dbPath"] }
  );

const canonicalSleepResponseSchema = z.object({
  summary: z.string(),
  source: z.string(),
  details: z.record(z.unknown())
});

const mockUpstreamSleepResponseSchema = z.object({
  ok: z.boolean(),
  source: z.string(),
  requestSummary: z.object({
    hasGravity: z.boolean(),
    gravityCount: z.number()
  }).optional(),
  sleep: z.unknown().optional()
});

export interface OpenWhoopSleepResponse {
  summary: string;
  source: string;
  details: Record<string, unknown>;
}

export interface OpenWhoopReprocessResponse {
  summary: string;
  source: string;
  cleaned: Record<string, unknown>;
  sleep: Record<string, unknown> | null;
  stats: Record<string, unknown>;
}

function parseUpstreamSleepResponse(body: unknown): OpenWhoopSleepResponse {
  const canonical = canonicalSleepResponseSchema.safeParse(body);
  if (canonical.success) return canonical.data;

  const mock = mockUpstreamSleepResponseSchema.safeParse(body);
  if (mock.success) {
    return {
      summary: "Sleep analysis completed.",
      source: mock.data.source,
      details: {
        ok: mock.data.ok,
        requestSummary: mock.data.requestSummary ?? null,
        sleep: mock.data.sleep ?? null
      }
    };
  }

  throw new Error("Upstream analysis response schema mismatch");
}

const canonicalReprocessResponseSchema = z.object({
  summary: z.string(),
  source: z.string(),
  cleaned: z.record(z.unknown()),
  sleep: z.record(z.unknown()).nullable(),
  stats: z.record(z.unknown())
});

function parseUpstreamReprocessResponse(body: unknown): OpenWhoopReprocessResponse {
  const parsed = canonicalReprocessResponseSchema.safeParse(body);
  if (parsed.success) return parsed.data;

  throw new Error("Upstream reprocess response schema mismatch");
}

export interface OpenWhoopAnalysisGateway {
  ping(): Promise<{
    ok: boolean;
    mode: "mock" | "upstream";
    latencyMs?: number;
    upstreamStatus?: number;
  }>;
  analyzeSleep(input: {
    dbPath?: string;
    gravitySamples?: Array<{ time: string; x: number; y: number; z: number }>;
    startIso?: string;
    endIso?: string;
  }): Promise<OpenWhoopSleepResponse>;
  analyzeReprocess(input: {
    dbPath?: string;
    startIso?: string;
    endIso?: string;
    heartRate?: Array<{ time: string; value: number }>;
    hrv?: Array<{ time: string; value: number }>;
    respiratoryRate?: Array<{ time: string; value: number }>;
    spo2?: Array<{ time: string; value: number }>;
    temperatureC?: Array<{ time: string; value: number }>;
    gravity?: Array<{ time: string; x: number; y: number; z: number }>;
  }): Promise<OpenWhoopReprocessResponse>;
  debugInfo?(): Record<string, unknown>;
}

export class ServiceBindingOpenWhoopAnalysisGateway
  implements OpenWhoopAnalysisGateway
{
  // SOURCE OF TRUTH: OpenWhoopServiceBindingGateway
  // BOUNDARY: Calls upstream analysis Worker through Cloudflare service bindings.
  // INVARIANT: Upstream routes are invoked as internal Worker-to-Worker requests.
  // FAILURE MODE: Throws with status/body context when upstream fails.
  constructor(
    private readonly upstream: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    },
    private readonly apiKey?: string
  ) {}

  async ping(): Promise<{
    ok: boolean;
    mode: "upstream";
    latencyMs?: number;
    upstreamStatus?: number;
  }> {
    const started = Date.now();
    const response = await this.fetchWithRetry("https://upstream/health", {
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
    dbPath?: string;
    gravitySamples?: Array<{ time: string; x: number; y: number; z: number }>;
    startIso?: string;
    endIso?: string;
  }): Promise<OpenWhoopSleepResponse> {
    const payload = upstreamRequestSchema.parse({
      dbPath: input.dbPath,
      gravitySamples: input.gravitySamples,
      startIso: input.startIso ?? null,
      endIso: input.endIso ?? null
    });

    const response = await this.fetchWithRetry("https://upstream/analysis/sleep", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {})
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Upstream analysis failed (${response.status}): ${body}`);
    }

    const body = await response.json().catch(() => null);
    return parseUpstreamSleepResponse(body);
  }

  async analyzeReprocess(input: {
    dbPath?: string;
    startIso?: string;
    endIso?: string;
    heartRate?: Array<{ time: string; value: number }>;
    hrv?: Array<{ time: string; value: number }>;
    respiratoryRate?: Array<{ time: string; value: number }>;
    spo2?: Array<{ time: string; value: number }>;
    temperatureC?: Array<{ time: string; value: number }>;
    gravity?: Array<{ time: string; x: number; y: number; z: number }>;
  }): Promise<OpenWhoopReprocessResponse> {
    const payload = upstreamReprocessRequestSchema.parse({
      dbPath: input.dbPath,
      startIso: input.startIso ?? null,
      endIso: input.endIso ?? null,
      heartRate: input.heartRate ?? [],
      hrv: input.hrv ?? [],
      respiratoryRate: input.respiratoryRate ?? [],
      spo2: input.spo2 ?? [],
      temperatureC: input.temperatureC ?? [],
      gravity: input.gravity ?? []
    });

    const response = await this.fetchWithRetry(
      "https://upstream/analysis/reprocess-history",
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
    return parseUpstreamReprocessResponse(body);
  }

  debugInfo(): Record<string, unknown> {
    return {
      gateway: "service-binding",
      hasApiKey: Boolean(this.apiKey)
    };
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
        const response = await this.upstream.fetch(url, {
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
    dbPath?: string;
    gravitySamples?: Array<{ time: string; x: number; y: number; z: number }>;
    startIso?: string;
    endIso?: string;
  }): Promise<OpenWhoopSleepResponse> {
    return {
      summary: "Mock analysis active. Set OPENWHOOP_ANALYSIS_URL to use real upstream.",
      source: "mock",
      details: {
        dbPath: input.dbPath,
        gravitySamples: input.gravitySamples?.length ?? 0,
        startIso: input.startIso ?? null,
        endIso: input.endIso ?? null
      }
    };
  }

  async analyzeReprocess(input: {
    dbPath?: string;
    startIso?: string;
    endIso?: string;
    heartRate?: Array<{ time: string; value: number }>;
    hrv?: Array<{ time: string; value: number }>;
    respiratoryRate?: Array<{ time: string; value: number }>;
    spo2?: Array<{ time: string; value: number }>;
    temperatureC?: Array<{ time: string; value: number }>;
    gravity?: Array<{ time: string; x: number; y: number; z: number }>;
  }): Promise<OpenWhoopReprocessResponse> {
    return {
      summary: "Mock reprocess active. Set OPENWHOOP_ANALYSIS_URL for real upstream.",
      source: "mock",
      cleaned: {
        heartRate: input.heartRate ?? [],
        hrv: input.hrv ?? [],
        respiratoryRate: input.respiratoryRate ?? [],
        spo2: input.spo2 ?? [],
        temperatureC: input.temperatureC ?? [],
        gravity: input.gravity ?? []
      },
      sleep: null,
      stats: {
        inputCounts: {
          heartRate: input.heartRate?.length ?? 0,
          hrv: input.hrv?.length ?? 0,
          respiratoryRate: input.respiratoryRate?.length ?? 0,
          spo2: input.spo2?.length ?? 0,
          temperatureC: input.temperatureC?.length ?? 0,
          gravity: input.gravity?.length ?? 0
        },
        outputCounts: {
          heartRate: input.heartRate?.length ?? 0,
          hrv: input.hrv?.length ?? 0,
          respiratoryRate: input.respiratoryRate?.length ?? 0,
          spo2: input.spo2?.length ?? 0,
          temperatureC: input.temperatureC?.length ?? 0,
          gravity: input.gravity?.length ?? 0
        },
        droppedCounts: {
          heartRate: 0,
          hrv: 0,
          respiratoryRate: 0,
          spo2: 0,
          temperatureC: 0,
          gravity: 0
        }
      }
    };
  }

  debugInfo(): Record<string, unknown> {
    return {
      gateway: "mock"
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
    dbPath?: string;
    gravitySamples?: Array<{ time: string; x: number; y: number; z: number }>;
    startIso?: string;
    endIso?: string;
  }): Promise<OpenWhoopSleepResponse> {
    const payload = upstreamRequestSchema.parse({
      dbPath: input.dbPath,
      gravitySamples: input.gravitySamples,
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
    return parseUpstreamSleepResponse(body);
  }

  async analyzeReprocess(input: {
    dbPath?: string;
    startIso?: string;
    endIso?: string;
    heartRate?: Array<{ time: string; value: number }>;
    hrv?: Array<{ time: string; value: number }>;
    respiratoryRate?: Array<{ time: string; value: number }>;
    spo2?: Array<{ time: string; value: number }>;
    temperatureC?: Array<{ time: string; value: number }>;
    gravity?: Array<{ time: string; x: number; y: number; z: number }>;
  }): Promise<OpenWhoopReprocessResponse> {
    const payload = upstreamReprocessRequestSchema.parse({
      dbPath: input.dbPath,
      startIso: input.startIso ?? null,
      endIso: input.endIso ?? null,
      heartRate: input.heartRate ?? [],
      hrv: input.hrv ?? [],
      respiratoryRate: input.respiratoryRate ?? [],
      spo2: input.spo2 ?? [],
      temperatureC: input.temperatureC ?? [],
      gravity: input.gravity ?? []
    });

    const response = await this.fetchWithRetry(
      this.endpointUrl("/analysis/reprocess-history"),
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
    return parseUpstreamReprocessResponse(body);
  }

  debugInfo(): Record<string, unknown> {
    return {
      gateway: "http",
      baseUrl: this.baseUrl,
      hasApiKey: Boolean(this.apiKey)
    };
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
