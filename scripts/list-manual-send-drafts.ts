import { listManualDraftOperatorEntries, resolveManualOutreachDatabaseSelection } from "../src/infrastructure/sqlite/manual-outreach-operator";

const database=resolveManualOutreachDatabaseSelection(),entries=listManualDraftOperatorEntries(database.path);
process.stdout.write(`Manual-send database: ${database.displayPath} (${database.source})\n`);
console.table(entries.map((entry)=>({"Operator ID":entry.operatorId,Recipient:entry.redactedRecipient,Company:entry.company,Title:entry.title,Subject:entry.subject,"Gmail draft created":"yes","Manual send attempted":entry.manualSendConfirmed?"yes":"no","Effective sent time":entry.effectiveSentAt??"—",Outcome:entry.outcome??"—",Suppressed:entry.suppressed?"yes":"no","Response state":entry.responseState??"—"})));
