"use server";

import { revalidatePath } from "next/cache";
import { FictionalDatasetUnavailableError } from "@/application/simulation/dataset-readiness";
import { runDailySimulation } from "@/application/simulation/run-daily-simulation";
import { getSimulationRepository, openRuntimeRepository } from "@/infrastructure/sqlite/runtime";
import { resolveManualOutreachDatabaseSelection } from "@/infrastructure/sqlite/manual-outreach-operator";
import { persistSourcingLimits } from "@/infrastructure/sqlite/sourcing-limits";

export interface SimulationActionState { error: string | null }

export async function runTodaySimulation(previousState: SimulationActionState): Promise<SimulationActionState> {
  void previousState;
  try {
    runDailySimulation(getSimulationRepository(), { instant: new Date(), random: Math.random });
    revalidatePath("/");
    return { error: null };
  } catch (error) {
    if (error instanceof FictionalDatasetUnavailableError) return { error: error.message };
    throw error;
  }
}

export interface SourcingLimitsActionState {
  status: "idle" | "success" | "error";
  message: string;
}

export async function updateSourcingLimits(
  _previousState: SourcingLimitsActionState,
  formData: FormData,
): Promise<SourcingLimitsActionState> {
  const dailyAllowance = Number(formData.get("dailyAllowance"));
  const maximumPerRun = Number(formData.get("maximumPerRun"));
  const repository = openRuntimeRepository(
    resolveManualOutreachDatabaseSelection().path,
  );
  try {
    repository.assertRuntimeSchema();
    persistSourcingLimits(repository, { dailyAllowance, maximumPerRun });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return {
      status: "error",
      message:
        code === "sourcing-daily-allowance-invalid"
          ? "Daily allowance must be a whole number from 1 to 1,000."
          : code === "sourcing-maximum-per-run-invalid"
            ? "Maximum per run must be a whole number from 1 to 20."
            : code === "sourcing-maximum-exceeds-daily-allowance"
              ? "Maximum per run cannot exceed the daily allowance."
              : "Limits were not changed. Check the values and try again.",
    };
  } finally {
    repository.close();
  }
  revalidatePath("/");
  revalidatePath("/candidates");
  return { status: "success", message: "Sourcing limits saved." };
}
