"use server";

import { revalidatePath } from "next/cache";
import { FictionalDatasetUnavailableError } from "@/application/simulation/dataset-readiness";
import { runDailySimulation } from "@/application/simulation/run-daily-simulation";
import { getSimulationRepository } from "@/infrastructure/sqlite/runtime";

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
