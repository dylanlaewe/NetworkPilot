import {offlineIntentReview} from "../src/domain/drafting/intent-review-fixtures";
console.log("# Offline intent review: 40 synthetic messages\n\nNo providers, databases, real contacts, or delivery. Methodology v4; professional catalog v9, recruiter catalog v6.\n");
for(const [i,draft] of offlineIntentReview().entries()){
  console.log(`## ${i+1}. ${draft.role}\n\nCompany type: ${draft.companyType}\n\nIntent: ${draft.outreachIntent.intent} (${draft.outreachIntent.version})\n\nReason: ${draft.outreachIntent.reason}\n\nSubject: ${draft.subject}\n\n${draft.body}\n\nCTA: ${draft.cta}\n\nWord count: ${draft.wordCount}\n`);
}
