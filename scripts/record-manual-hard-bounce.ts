import { recordOperatorReportedHardBounce, resolveManualSendOperatorEntry } from "../src/application/manual-outreach";
import { SqliteSimulationRepository } from "../src/infrastructure/sqlite/database";
import { listManualDraftOperatorEntries, resolveManualOutreachDatabaseSelection } from "../src/infrastructure/sqlite/manual-outreach-operator";

const CONFIRMATION="--confirm-i-received-address-not-found";
function argument(name:string):string|undefined{const index=process.argv.indexOf(name);return index>=0?process.argv[index+1]:undefined;}

function main():void{
  if(!process.argv.includes(CONFIRMATION))throw new Error(`manual-hard-bounce-explicit-confirmation-required:${CONFIRMATION}`);
  const operatorId=argument("--id"),sentAt=argument("--sent-at");
  if(!operatorId||!sentAt)throw new Error("usage: npm run manual-send:bounce -- --id <npms-id> --sent-at <ISO-8601> --confirm-i-received-address-not-found");
  const effectiveSentAt=new Date(sentAt),database=resolveManualOutreachDatabaseSelection(),entry=resolveManualSendOperatorEntry(listManualDraftOperatorEntries(database.path),operatorId);
  if(Number.isNaN(effectiveSentAt.getTime()))throw new Error("manual-send-time-invalid");
  const repository=new SqliteSimulationRepository(database.path);
  try{
    repository.migrate();
    const record=recordOperatorReportedHardBounce({snapshotId:entry.snapshotId,effectiveSentAt,now:()=>new Date(),repository});
    process.stdout.write(`${JSON.stringify({database:database.displayPath,databaseSource:database.source,operatorId,state:"operator-reported-hard-bounce",confirmationSource:record.confirmationSource,effectiveSentAt:record.effectiveSentAt,outcome:record.outcome,operationVersion:record.operationVersion},null,2)}\n`);
  }finally{repository.close();}
}
main();
