import { DEFAULT_DATABASE_PATH, SqliteSimulationRepository } from "../src/infrastructure/sqlite/database";
import { assertExistingDatabaseIsResettable, assertResetEnvironment, resolveSafeResetTarget } from "../src/infrastructure/sqlite/reset-policy";
import { seedFictionalData } from "../src/infrastructure/sqlite/seed";

assertResetEnvironment(process.env.NODE_ENV);
const configured = process.env.NETWORKPILOT_DATABASE_PATH ?? DEFAULT_DATABASE_PATH;
const target = resolveSafeResetTarget(configured);
assertExistingDatabaseIsResettable(target);
console.log(`Resetting fictional simulation database: ${target}`);
const repository = new SqliteSimulationRepository(target);
repository.native.exec("DROP TABLE IF EXISTS candidate_suppression_entries; DROP TABLE IF EXISTS manual_outreach_audit; DROP TABLE IF EXISTS manual_outreach_records; DROP TABLE IF EXISTS gmail_draft_operations; DROP TABLE IF EXISTS gmail_connection_metadata; DROP TABLE IF EXISTS provider_operations; DROP TABLE IF EXISTS provider_daily_budgets; DROP TABLE IF EXISTS candidate_review_audit; DROP TABLE IF EXISTS imported_candidates; DROP TABLE IF EXISTS import_batches; DROP TABLE IF EXISTS campaign_plan_lifecycle; DROP TABLE IF EXISTS campaign_plan_decisions; DROP TABLE IF EXISTS campaign_plans; DROP TABLE IF EXISTS drafts; DROP TABLE IF EXISTS personalization_evidence; DROP TABLE IF EXISTS fictional_targeting_profiles; DROP TABLE IF EXISTS fictional_company_profiles; DROP TABLE IF EXISTS target_companies; DROP TABLE IF EXISTS qualification_decisions; DROP TABLE IF EXISTS outreach_events; DROP TABLE IF EXISTS suppression_entries; DROP TABLE IF EXISTS simulation_runs; DROP TABLE IF EXISTS prospects; DROP TABLE IF EXISTS companies; DROP TABLE IF EXISTS campaign_settings; DROP TABLE IF EXISTS schema_migrations;");
repository.migrate();
seedFictionalData(repository);
console.log(`Reset complete: ${repository.countProspects()} fictional prospects.`);
repository.close();
