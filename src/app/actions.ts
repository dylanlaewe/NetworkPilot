"use server";
import { revalidatePath } from "next/cache";
import { runDailySimulation } from "@/application/simulation/run-daily-simulation";
import { getSimulationRepository } from "@/infrastructure/sqlite/runtime";
export async function runTodaySimulation(): Promise<void> { runDailySimulation(getSimulationRepository(), { instant: new Date(), random: Math.random }); revalidatePath("/"); }
