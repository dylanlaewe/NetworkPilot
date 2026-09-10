import { listManualDraftOperatorEntries, resolveManualOutreachDatabaseSelection } from "../src/infrastructure/sqlite/manual-outreach-operator";

const database=resolveManualOutreachDatabaseSelection(),entries=listManualDraftOperatorEntries(database.path);
process.stdout.write(`Manual-send database: ${database.displayPath} (${database.source})\n`);
console.table(entries.map((entry)=>({id:entry.operatorId,recipient:entry.redactedRecipient,company:entry.company,title:entry.title,subject:entry.subject,"Gmail draft created":"yes","Manual send confirmed":entry.manualSendConfirmed?"yes":"no"})));
