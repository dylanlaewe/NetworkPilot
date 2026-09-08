import type { SimulationRepository } from "./types";

export const FICTIONAL_DATASET_UNAVAILABLE = "FICTIONAL_DATASET_UNAVAILABLE" as const;

export interface DatasetReadiness {
  ready: boolean;
  datasetType?: string;
  prospectCount: number;
}

export class FictionalDatasetUnavailableError extends Error {
  readonly code = FICTIONAL_DATASET_UNAVAILABLE;
  constructor(readonly readiness: DatasetReadiness) {
    super("Fictional simulation data is unavailable. Run npm run db:seed before starting a simulation.");
    this.name = "FictionalDatasetUnavailableError";
  }
}

export function getFictionalDatasetReadiness(repository: SimulationRepository): DatasetReadiness {
  const status = repository.getDatasetStatus();
  return { ...status, ready: status.datasetType === "fictional" && status.prospectCount > 0 };
}

export function requireFictionalDataset(repository: SimulationRepository): DatasetReadiness {
  const readiness = getFictionalDatasetReadiness(repository);
  if (!readiness.ready) throw new FictionalDatasetUnavailableError(readiness);
  return readiness;
}
