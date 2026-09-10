import { confirmManualSendByOperatorId, resolveManualSendOperatorEntry } from "../src/application/manual-outreach";
import { SqliteSimulationRepository } from "../src/infrastructure/sqlite/database";
import { listManualDraftOperatorEntries, resolveManualOutreachDatabaseSelection } from "../src/infrastructure/sqlite/manual-outreach-operator";

const CONFIRMATION = "--confirm-i-sent-this-in-gmail";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function main(): void {
  if (!process.argv.includes(CONFIRMATION)) {
    throw new Error(`manual-send-explicit-confirmation-required:${CONFIRMATION}`);
  }
  const operatorId = argument("--id");
  const sentAt = argument("--sent-at");
  if (!operatorId || !sentAt) {
    throw new Error("usage: npm run manual-send:confirm -- --id <npms-id> --sent-at <ISO-8601> --confirm-i-sent-this-in-gmail");
  }
  const effectiveSentAt = new Date(sentAt);
  const database=resolveManualOutreachDatabaseSelection();
  const entries=listManualDraftOperatorEntries(database.path);
  const entry=resolveManualSendOperatorEntry(entries,operatorId);
  if(Number.isNaN(effectiveSentAt.getTime()))throw new Error("manual-send-time-invalid");
  const repository = new SqliteSimulationRepository(database.path);
  try {
    repository.migrate();
    const record = confirmManualSendByOperatorId({
      entries:[entry],
      operatorId,
      effectiveSentAt,
      now: () => new Date(),
      repository,
    });
    process.stdout.write(`${JSON.stringify({
      database: database.displayPath,
      databaseSource: database.source,
      operatorId,
      state: "operator-confirmed-manual-send",
      confirmationSource: record.confirmationSource,
      effectiveSentAt: record.effectiveSentAt,
      outcome: record.outcome,
      operationVersion: record.operationVersion,
    }, null, 2)}\n`);
  } finally {
    repository.close();
  }
}

main();
