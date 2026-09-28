import { SqliteSimulationRepository } from "./database";
import { assertRuntimeSchema } from "./schema-contract";

const globalDatabase = globalThis as unknown as { networkPilotRepository?: SqliteSimulationRepository };
const systemSchemaEnvironment = () => ({
  ...process.env,
  NETWORKPILOT_FIVE_BUCKET_ENABLED: "false",
});
export function getSimulationRepository(): SqliteSimulationRepository {
  if (!globalDatabase.networkPilotRepository) {
    const repository = new SqliteSimulationRepository();
    try {
      assertRuntimeSchema(repository.native, systemSchemaEnvironment());
      globalDatabase.networkPilotRepository = repository;
    } catch (error) {
      repository.close();
      throw error;
    }
  }
  assertRuntimeSchema(globalDatabase.networkPilotRepository.native, systemSchemaEnvironment());
  return globalDatabase.networkPilotRepository;
}

export function openRuntimeRepository(databasePath?: string, options: {readonly?:boolean} = {}): SqliteSimulationRepository {
  const repository = new SqliteSimulationRepository(databasePath, options.readonly?{readonly:true,fileMustExist:true}:{});
  try {
    repository.assertRuntimeSchema(
      databasePath === undefined ? systemSchemaEnvironment() : process.env,
    );
    return repository;
  } catch (error) {
    repository.close();
    throw error;
  }
}
