import { DEFAULT_DATABASE_PATH, SqliteSimulationRepository } from "../src/infrastructure/sqlite/database";
import { assertExistingDatabaseIsResettable, assertResetEnvironment, resolveSafeResetTarget } from "../src/infrastructure/sqlite/reset-policy";

assertResetEnvironment(process.env.NODE_ENV);
const configured = process.env.NETWORKPILOT_DATABASE_PATH ?? DEFAULT_DATABASE_PATH;
const target = resolveSafeResetTarget(configured);
assertExistingDatabaseIsResettable(target);
console.log(`Resetting fictional simulation database: ${target}`);
const repository = new SqliteSimulationRepository(target);
repository.native.pragma("foreign_keys = OFF");
for(const {name} of repository.native.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as Array<{name:string}>){
  repository.native.exec(`DROP TABLE ${JSON.stringify(name)}`);
}
repository.close();
console.log("Reset complete. Run npm run db:migrate, then npm run db:seed.");
