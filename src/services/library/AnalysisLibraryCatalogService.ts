export interface AnalysisLibraryOption {
  id: string;
  name: string;
  layer: "decode" | "cleaning" | "sleep" | "actigraphy" | "hrv";
  license: string;
  fit: "high" | "medium" | "low";
  notes: string;
}

export class AnalysisLibraryCatalogService {
  // SOURCE OF TRUTH: AnalysisLibraryCatalog
  // BOUNDARY: Publishes approved backend library candidates and integration fit.
  // INVARIANT: Catalog is deterministic and versioned with backend deployments.
  // FAILURE MODE: Returns static defaults if dynamic registry is unavailable.
  getCatalog() {
    const options: AnalysisLibraryOption[] = [
      {
        id: "construct",
        name: "construct",
        layer: "decode",
        license: "MIT",
        fit: "high",
        notes: "Declarative binary packet parsing for proprietary BLE payload schemas."
      },
      {
        id: "bitstruct",
        name: "bitstruct",
        layer: "decode",
        license: "MIT",
        fit: "high",
        notes: "Bit-level flag parsing for BLE payload fields (e.g., HR flags layouts)."
      },
      {
        id: "neurokit2",
        name: "NeuroKit2",
        layer: "cleaning",
        license: "MIT",
        fit: "high",
        notes: "Primary physiology cleanup and HR/resp feature extraction."
      },
      {
        id: "pyhrv",
        name: "pyHRV",
        layer: "hrv",
        license: "BSD-3-Clause",
        fit: "high",
        notes: "Standardized HRV metrics from cleaned NN interval timelines."
      },
      {
        id: "asleep",
        name: "OxWearables asleep",
        layer: "sleep",
        license: "MIT",
        fit: "high",
        notes: "Wrist accelerometer-based sleep staging candidate."
      },
      {
        id: "hypnospy",
        name: "HypnosPy",
        layer: "sleep",
        license: "MIT",
        fit: "high",
        notes: "Device-agnostic sleep inference using accelerometry and heart-rate signals."
      },
      {
        id: "pyactigraphy",
        name: "pyActigraphy",
        layer: "actigraphy",
        license: "GPL-3.0",
        fit: "medium",
        notes: "Strong actigraphy features; verify GPL compatibility for production usage."
      },
      {
        id: "ggir",
        name: "GGIR",
        layer: "actigraphy",
        license: "GPL-3",
        fit: "medium",
        notes: "Excellent research benchmark pipeline; heavier R-runtime ops."
      }
    ];

    return {
      version: "2026-05-16",
      recommendedStack: {
        decode: ["construct", "bitstruct"],
        cleaning: ["neurokit2", "pyhrv"],
        sleep: ["asleep", "hypnospy"]
      },
      options
    };
  }
}
