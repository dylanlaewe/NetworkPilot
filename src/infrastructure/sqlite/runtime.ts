import { SqliteSimulationRepository } from "./database";
import { assertRuntimeSchema } from "./schema-contract";

const globalDatabase = globalThis as unknown as { networkPilotRepository?: SqliteSimulationRepository };
export function getSimulationRepository(): SqliteSimulationRepository {
  if (!globalDatabase.networkPilotRepository) {
    const repository = new SqliteSimulationRepository();
    try {
      assertRuntimeSchema(repository.native);
      globalDatabase.networkPilotRepository = repository;
    } catch (error) {
      repository.close();
      throw error;
    }
  }
  assertRuntimeSchema(globalDatabase.networkPilotRepository.native);
  return globalDatabase.networkPilotRepository;
}

export function openRuntimeRepository(databasePath?: string, options: {readonly?:boolean} = {}): SqliteSimulationRepository {
  const repository = new SqliteSimulationRepository(databasePath, options.readonly?{readonly:true,fileMustExist:true}:{});
  try {
    repository.assertRuntimeSchema();
    return repository;
  } catch (error) {
    repository.close();
    throw error;
  }
}
