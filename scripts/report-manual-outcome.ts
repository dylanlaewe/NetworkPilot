import { MANUAL_OUTREACH_OUTCOMES, reportManualOutreachOutcome, resolveManualSendOperatorEntry, type ManualOutreachOutcome } from "../src/application/manual-outreach";
import { SqliteSimulationRepository } from "../src/infrastructure/sqlite/database";
import {listManualDraftOperatorEntries,resolveManualOutreachDatabaseSelection} from "../src/infrastructure/sqlite/manual-outreach-operator";

function argument(name: string): string | undefined { const index=process.argv.indexOf(name);return index>=0?process.argv[index+1]:undefined; }
function main():void{
  const operatorId=argument("--id"),outcome=argument("--outcome");
  if(!operatorId||!outcome||!(MANUAL_OUTREACH_OUTCOMES as readonly string[]).includes(outcome))throw new Error(`usage: npm run manual-outreach:outcome -- --id <npms-id> --outcome <${MANUAL_OUTREACH_OUTCOMES.join("|")}>`);
  const database=resolveManualOutreachDatabaseSelection(),entry=resolveManualSendOperatorEntry(listManualDraftOperatorEntries(database.path),operatorId),repository=new SqliteSimulationRepository(database.path);
  try{repository.migrate();const record=reportManualOutreachOutcome({snapshotId:entry.snapshotId,outcome:outcome as ManualOutreachOutcome,now:()=>new Date(),repository});process.stdout.write(`${JSON.stringify({database:database.displayPath,operatorId,state:"operator-reported-outcome",outcome:record.outcome,updatedAt:record.updatedAt},null,2)}\n`);}finally{repository.close();}
}
main();
