import { SqliteSimulationRepository } from "../src/infrastructure/sqlite/database";
import { applyPendingMigrations } from "../src/infrastructure/sqlite/migration-runner";
import { resolveExplicitMigrationTarget } from "../src/infrastructure/sqlite/migration-target";

const target = resolveExplicitMigrationTarget();
console.log(`Migration target (absolute): ${target}`);
const repository = new SqliteSimulationRepository(target, { fileMustExist: true });
try {
  const applied=applyPendingMigrations(repository);
  console.log(applied.length?`Applied: ${applied.join(", ")}`:"Database schema is current.");
} finally {
  repository.close();
}
