import { SqliteSimulationRepository } from "../src/infrastructure/sqlite/database";
const repository = new SqliteSimulationRepository();
repository.migrate();
console.log("Migrations applied successfully.");
repository.close();
