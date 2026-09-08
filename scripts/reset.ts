import { resolve } from "node:path";
import { DEFAULT_DATABASE_PATH, SqliteSimulationRepository } from "../src/infrastructure/sqlite/database";
import { seedFictionalData } from "../src/infrastructure/sqlite/seed";

if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") throw new Error("Reset refused: NODE_ENV must be development or test.");
const configured = process.env.NETWORKPILOT_DATABASE_PATH ?? DEFAULT_DATABASE_PATH;
if (configured === ":memory:") throw new Error("Reset refused: a persistent local database path is required.");
const target = resolve(configured);
const localDataDirectory = `${resolve(process.cwd(), "data")}/`;
if (!target.startsWith(localDataDirectory)) throw new Error(`Reset refused: target must be inside ${localDataDirectory}`);
console.log(`Resetting fictional simulation database: ${target}`);
const repository = new SqliteSimulationRepository(target);
repository.native.exec("DROP TABLE IF EXISTS qualification_decisions; DROP TABLE IF EXISTS outreach_events; DROP TABLE IF EXISTS suppression_entries; DROP TABLE IF EXISTS simulation_runs; DROP TABLE IF EXISTS prospects; DROP TABLE IF EXISTS companies; DROP TABLE IF EXISTS campaign_settings; DROP TABLE IF EXISTS schema_migrations;");
repository.migrate();
seedFictionalData(repository);
console.log(`Reset complete: ${repository.countProspects()} fictional prospects.`);
repository.close();
