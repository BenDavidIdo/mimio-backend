import type {
  ReprocessHistoryRequestPayload,
  ReprocessHistoryResponsePayload
} from "../../contracts/reprocess.js";

type ScalarPoint = { time: string; value: number };
type GravityPoint = { time: string; x: number; y: number; z: number };

export class HistoryReprocessService {
  // SOURCE OF TRUTH: HistoricalTimelineCleanup
  // BOUNDARY: Normalizes and denoises full historical timeseries for HealthKit rewrite preparation.
  // INVARIANT: Output is strictly time-ordered and timestamp-preserving.
  // FAILURE MODE: Drops invalid/outlier points and reports dropped counts instead of throwing.
  reprocess(
    input: ReprocessHistoryRequestPayload
  ): Omit<ReprocessHistoryResponsePayload, "source"> & { source: string } {
    const hr = this.cleanScalar(input.heartRate, { min: 30, max: 230, maxDeltaPerSec: 6 });
    const hrv = this.cleanScalar(input.hrv, { min: 5, max: 400, maxDeltaPerSec: 20 });
    const resp = this.cleanScalar(input.respiratoryRate, {
      min: 4,
      max: 45,
      maxDeltaPerSec: 0.8
    });
    const spo2 = this.cleanScalar(input.spo2, { min: 0.7, max: 1.0, maxDeltaPerSec: 0.02 });
    const temp = this.cleanScalar(input.temperatureC, {
      min: 30,
      max: 43,
      maxDeltaPerSec: 0.03
    });
    const gravity = this.cleanGravity(input.gravity);

    const sleep = this.inferSleepFromGravity(gravity.points);

    const inputCounts = {
      heartRate: input.heartRate.length,
      hrv: input.hrv.length,
      respiratoryRate: input.respiratoryRate.length,
      spo2: input.spo2.length,
      temperatureC: input.temperatureC.length,
      gravity: input.gravity.length
    };
    const outputCounts = {
      heartRate: hr.points.length,
      hrv: hrv.points.length,
      respiratoryRate: resp.points.length,
      spo2: spo2.points.length,
      temperatureC: temp.points.length,
      gravity: gravity.points.length
    };
    const droppedCounts = {
      heartRate: hr.dropped,
      hrv: hrv.dropped,
      respiratoryRate: resp.dropped,
      spo2: spo2.dropped,
      temperatureC: temp.dropped,
      gravity: gravity.dropped
    };

    return {
      summary: "Historical reprocess completed",
      source: "backend-local-cleaner",
      cleaned: {
        heartRate: hr.points,
        hrv: hrv.points,
        respiratoryRate: resp.points,
        spo2: spo2.points,
        temperatureC: temp.points,
        gravity: gravity.points
      },
      sleep,
      stats: { inputCounts, outputCounts, droppedCounts }
    };
  }

  private cleanScalar(
    points: ScalarPoint[],
    config: { min: number; max: number; maxDeltaPerSec: number }
  ): { points: ScalarPoint[]; dropped: number } {
    const sorted = [...points].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
    const out: ScalarPoint[] = [];
    let dropped = 0;
    let last: ScalarPoint | null = null;

    for (const p of sorted) {
      if (!Number.isFinite(p.value)) {
        dropped += 1;
        continue;
      }
      if (p.value < config.min || p.value > config.max) {
        dropped += 1;
        continue;
      }

      if (last) {
        const dtSec = Math.max(
          0.2,
          (Date.parse(p.time) - Date.parse(last.time)) / 1000
        );
        const maxJump = config.maxDeltaPerSec * dtSec;
        if (Math.abs(p.value - last.value) > maxJump) {
          dropped += 1;
          continue;
        }
      }

      out.push(p);
      last = p;
    }

    return { points: out, dropped };
  }

  private cleanGravity(points: GravityPoint[]): { points: GravityPoint[]; dropped: number } {
    const sorted = [...points].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
    const out: GravityPoint[] = [];
    let dropped = 0;
    for (const p of sorted) {
      if (
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        !Number.isFinite(p.z)
      ) {
        dropped += 1;
        continue;
      }
      const mag = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
      if (mag < 0.2 || mag > 2.5) {
        dropped += 1;
        continue;
      }
      out.push(p);
    }
    return { points: out, dropped };
  }

  private inferSleepFromGravity(gravity: GravityPoint[]): ReprocessHistoryResponsePayload["sleep"] {
    if (gravity.length < 30) return null;
    const deltas: Array<{ time: string; delta: number }> = [];
    for (let i = 1; i < gravity.length; i += 1) {
      const a = gravity[i - 1];
      const b = gravity[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      deltas.push({ time: b.time, delta: Math.sqrt(dx * dx + dy * dy + dz * dz) });
    }

    const still = deltas.filter((d) => d.delta < 0.01);
    const stillFraction = deltas.length ? still.length / deltas.length : 0;
    if (stillFraction < 0.55) return null;

    const startIso = gravity[Math.floor(gravity.length * 0.1)]?.time ?? gravity[0].time;
    const endIso = gravity[Math.floor(gravity.length * 0.9)]?.time ?? gravity[gravity.length - 1].time;

    const totalMs = Date.parse(endIso) - Date.parse(startIso);
    if (totalMs < 90 * 60 * 1000) return null;

    const q1 = new Date(Date.parse(startIso) + totalMs * 0.2).toISOString();
    const q2 = new Date(Date.parse(startIso) + totalMs * 0.45).toISOString();
    const q3 = new Date(Date.parse(startIso) + totalMs * 0.7).toISOString();

    return {
      startIso,
      endIso,
      confidence: Math.min(0.95, Math.max(0.55, stillFraction)),
      method: "gravity-stillness-heuristic-v1",
      stages: [
        { stage: "light", startIso, endIso: q1 },
        { stage: "deep", startIso: q1, endIso: q2 },
        { stage: "rem", startIso: q2, endIso: q3 },
        { stage: "light", startIso: q3, endIso }
      ]
    };
  }
}
