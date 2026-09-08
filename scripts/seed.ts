import { SqliteSimulationRepository } from "../src/infrastructure/sqlite/database";
import { seedFictionalData } from "../src/infrastructure/sqlite/seed";
const repository = new SqliteSimulationRepository();
repository.migrate();
seedFictionalData(repository);
console.log(`Fictional seed complete: ${repository.countProspects()} prospects.`);
repository.close();
