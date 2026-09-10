import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { confirmOperatorManualSend } from "../src/application/manual-outreach";
import { SqliteSimulationRepository } from "../src/infrastructure/sqlite/database";

const CONFIRMATION = "--confirm-i-sent-this-in-gmail";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function main(): void {
  if (!process.argv.includes(CONFIRMATION)) {
    throw new Error(`manual-send-explicit-confirmation-required:${CONFIRMATION}`);
  }
  const suppliedSnapshotId = argument("--snapshot-id");
  const snapshotHash = argument("--snapshot-hash");
  const sentAt = argument("--sent-at");
  if ((!suppliedSnapshotId && !snapshotHash) || (suppliedSnapshotId && snapshotHash) || !sentAt) {
    throw new Error("usage: npm run manual-send:confirm -- (--snapshot-id <immutable-id> | --snapshot-hash <12+ hex>) --sent-at <ISO-8601> --confirm-i-sent-this-in-gmail");
  }
  const effectiveSentAt = new Date(sentAt);
  const repository = new SqliteSimulationRepository(
    process.env.NETWORKPILOT_DATABASE_PATH ?? resolve(process.cwd(), "data/networkpilot.sqlite"),
  );
  try {
    repository.migrate();
    let snapshotId=suppliedSnapshotId;
    if(snapshotHash){
      if(!/^[a-f0-9]{12,64}$/i.test(snapshotHash))throw new Error("manual-send-snapshot-hash-invalid");
      const rows=repository.native.prepare("SELECT draft_snapshot_id FROM gmail_draft_operations WHERE state='gmail-draft-created'").all() as Array<{draft_snapshot_id:string}>;
      const matches=rows.filter((row)=>createHash("sha256").update(row.draft_snapshot_id).digest("hex").startsWith(snapshotHash.toLowerCase()));
      if(matches.length!==1)throw new Error(matches.length?"manual-send-snapshot-hash-ambiguous":"manual-send-snapshot-hash-not-found");
      snapshotId=matches[0]!.draft_snapshot_id;
    }
    if(!snapshotId)throw new Error("manual-send-snapshot-required");
    const record = confirmOperatorManualSend({
      snapshotId,
      effectiveSentAt,
      now: () => new Date(),
      repository,
    });
    process.stdout.write(`${JSON.stringify({
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
