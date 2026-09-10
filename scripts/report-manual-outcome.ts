import { resolve } from "node:path";
import { MANUAL_OUTREACH_OUTCOMES, reportManualOutreachOutcome, type ManualOutreachOutcome } from "../src/application/manual-outreach";
import { SqliteSimulationRepository } from "../src/infrastructure/sqlite/database";

function argument(name: string): string | undefined { const index=process.argv.indexOf(name);return index>=0?process.argv[index+1]:undefined; }
function main():void{
  const snapshotId=argument("--snapshot-id"),outcome=argument("--outcome");
  if(!snapshotId||!outcome||!(MANUAL_OUTREACH_OUTCOMES as readonly string[]).includes(outcome))throw new Error(`usage: npm run manual-outreach:outcome -- --snapshot-id <immutable-id> --outcome <${MANUAL_OUTREACH_OUTCOMES.join("|")}>`);
  const repository=new SqliteSimulationRepository(process.env.NETWORKPILOT_DATABASE_PATH??resolve(process.cwd(),"data/networkpilot.sqlite"));
  try{repository.migrate();const record=reportManualOutreachOutcome({snapshotId,outcome:outcome as ManualOutreachOutcome,now:()=>new Date(),repository});process.stdout.write(`${JSON.stringify({state:"operator-reported-outcome",outcome:record.outcome,updatedAt:record.updatedAt},null,2)}\n`);}finally{repository.close();}
}
main();
