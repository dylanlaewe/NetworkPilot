import { SqliteSimulationRepository } from "./database";

const globalDatabase = globalThis as unknown as { networkPilotRepository?: SqliteSimulationRepository };
export function getSimulationRepository(): SqliteSimulationRepository {
  if (!globalDatabase.networkPilotRepository) {
    globalDatabase.networkPilotRepository = new SqliteSimulationRepository();
    globalDatabase.networkPilotRepository.migrate();
  }
  return globalDatabase.networkPilotRepository;
}
