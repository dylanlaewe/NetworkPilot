export const GMAIL_METADATA_SCOPE="https://www.googleapis.com/auth/gmail.metadata" as const;
export interface OwnedGmailIdentity {snapshotId:string;gmailDraftId:string;gmailMessageId:string;rfcMessageId:string|null;}
export interface GmailSentMetadata {gmailMessageId:string;rfcMessageId:string|null;labelIds:readonly string[];sentAt:string;}
export type MetadataMatch={kind:"exact";snapshotId:string;sentAt:string}|{kind:"none"|"ambiguous"};
export function matchOwnedSentMessage(owned:OwnedGmailIdentity,records:readonly GmailSentMetadata[]):MetadataMatch{const matches=records.filter((record)=>record.labelIds.includes("SENT")&&(record.gmailMessageId===owned.gmailMessageId||Boolean(owned.rfcMessageId&&record.rfcMessageId===owned.rfcMessageId)));if(matches.length===0)return{kind:"none"};if(matches.length!==1)return{kind:"ambiguous"};return{kind:"exact",snapshotId:owned.snapshotId,sentAt:matches[0]!.sentAt};}
export function gmailMetadataReconciliationEnabled(environment:Readonly<Record<string,string|undefined>>):boolean{return environment.NETWORKPILOT_GMAIL_METADATA_RECONCILIATION_ENABLED==="true";}
