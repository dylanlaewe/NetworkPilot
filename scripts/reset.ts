import { DEFAULT_DATABASE_PATH, SqliteSimulationRepository } from "../src/infrastructure/sqlite/database";
import { assertExistingDatabaseIsResettable, assertResetEnvironment, resolveSafeResetTarget } from "../src/infrastructure/sqlite/reset-policy";
import { seedFictionalData } from "../src/infrastructure/sqlite/seed";

assertResetEnvironment(process.env.NODE_ENV);
const configured = process.env.NETWORKPILOT_DATABASE_PATH ?? DEFAULT_DATABASE_PATH;
const target = resolveSafeResetTarget(configured);
assertExistingDatabaseIsResettable(target);
console.log(`Resetting fictional simulation database: ${target}`);
const repository = new SqliteSimulationRepository(target);
repository.native.exec("DROP TABLE IF EXISTS drafts; DROP TABLE IF EXISTS personalization_evidence; DROP TABLE IF EXISTS target_companies; DROP TABLE IF EXISTS fictional_targeting_profiles; DROP TABLE IF EXISTS fictional_company_profiles; DROP TABLE IF EXISTS qualification_decisions; DROP TABLE IF EXISTS outreach_events; DROP TABLE IF EXISTS suppression_entries; DROP TABLE IF EXISTS simulation_runs; DROP TABLE IF EXISTS prospects; DROP TABLE IF EXISTS companies; DROP TABLE IF EXISTS campaign_settings; DROP TABLE IF EXISTS schema_migrations;");
repository.migrate();
seedFictionalData(repository);
console.log(`Reset complete: ${repository.countProspects()} fictional prospects.`);
repository.close();
