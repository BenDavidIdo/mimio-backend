import type {
  CleanWindowRequestPayload,
  CleanWindowSamplePayload
} from "../../contracts/cleanWindow.js";

interface CleanWindowResult {
  summary: string;
  source: "backend-cleaner";
  inputSamples: number;
  outputSamples: number;
  droppedFields: number;
  samples: CleanWindowSamplePayload[];
}

export class CleanWindowService {
  // SOURCE OF TRUTH: RealtimeWindowCleaning
  // BOUNDARY: Applies conservative physiological range + jump filters to batched realtime metrics.
  // INVARIANT: Service may drop suspicious values but never fabricates new timestamps.
  // FAILURE MODE: Returns partial cleaned data with dropped field count instead of throwing.
  clean(input: CleanWindowRequestPayload): CleanWindowResult {
    const sorted = [...input.samples].sort(
      (a, b) => Date.parse(a.time) - Date.parse(b.time)
    );

    let dropped = 0;
    let lastGood: CleanWindowSamplePayload | null = null;
    const output: CleanWindowSamplePayload[] = [];

    for (const sample of sorted) {
      const cleaned: CleanWindowSamplePayload = { time: sample.time };
      const dtSec = lastGood
        ? Math.max(1, (Date.parse(sample.time) - Date.parse(lastGood.time)) / 1000)
        : 1;

      cleaned.heartRateBPM = this.accept(
        sample.heartRateBPM,
        30,
        230,
        lastGood?.heartRateBPM,
        6 * dtSec
      );
      cleaned.respiratoryRatePerMin = this.accept(
        sample.respiratoryRatePerMin,
        5,
        45,
        lastGood?.respiratoryRatePerMin,
        1.5 * dtSec
      );
      cleaned.oxygenSaturationFraction = this.accept(
        sample.oxygenSaturationFraction,
        0.7,
        1.0,
        lastGood?.oxygenSaturationFraction,
        0.03 * dtSec
      );
      cleaned.bodyTemperatureCelsius = this.accept(
        sample.bodyTemperatureCelsius,
        30,
        43,
        lastGood?.bodyTemperatureCelsius,
        0.05 * dtSec
      );
      cleaned.hrvMs = this.accept(sample.hrvMs, 1, 500, lastGood?.hrvMs, 80);
      cleaned.restingHeartRateBPM = this.accept(
        sample.restingHeartRateBPM,
        30,
        180,
        lastGood?.restingHeartRateBPM,
        4 * dtSec
      );

      dropped += this.countDropped(sample, cleaned);
      output.push(cleaned);
      lastGood = cleaned;
    }

    return {
      summary: "Realtime window cleaned.",
      source: "backend-cleaner",
      inputSamples: input.samples.length,
      outputSamples: output.length,
      droppedFields: dropped,
      samples: output
    };
  }

  private accept(
    value: number | undefined,
    min: number,
    max: number,
    last: number | undefined,
    maxJump: number
  ): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
    if (value < min || value > max) return undefined;
    if (typeof last === "number" && Math.abs(value - last) > maxJump) return undefined;
    return value;
  }

  private countDropped(
    original: CleanWindowSamplePayload,
    cleaned: CleanWindowSamplePayload
  ): number {
    let dropped = 0;
    const keys: Array<keyof CleanWindowSamplePayload> = [
      "heartRateBPM",
      "hrvMs",
      "restingHeartRateBPM",
      "respiratoryRatePerMin",
      "oxygenSaturationFraction",
      "bodyTemperatureCelsius"
    ];
    for (const key of keys) {
      if (original[key] !== undefined && cleaned[key] === undefined) dropped += 1;
    }
    return dropped;
  }
}
