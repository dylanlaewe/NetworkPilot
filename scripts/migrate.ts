import { SqliteSimulationRepository } from "../src/infrastructure/sqlite/database";
import { applyPendingMigrations } from "../src/infrastructure/sqlite/migration-runner";
import { displayDatabasePath } from "../src/infrastructure/sqlite/schema-contract";
const repository = new SqliteSimulationRepository();
try {
  console.log(`Migration target: ${displayDatabasePath(repository.native.name)}`);
  const applied=applyPendingMigrations(repository);
  console.log(applied.length?`Applied: ${applied.join(", ")}`:"Database schema is current.");
} finally {
  repository.close();
}
