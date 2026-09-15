import {describe,expect,it} from "vitest";
import {gmailSendBlockReason,type CommandCenterDraftReview,type GmailDraftReadiness} from ".";

const ready:GmailDraftReadiness={available:true,reason:null};
const review=(blockedReason:string|null=null):CommandCenterDraftReview=>({outreachTrack:"professional",candidateId:"candidate",recipient:"A*** R.",recipientEmail:"fixture@example.invalid",company:"Fictional Co",companyId:"fictional-co",title:"Engineer",primaryFunction:"engineering",secondaryFunctions:[],persona:"experienced",experience:7,industry:"Technology",location:"Boston",score:91,lane:"engineering",templateVariant:"direct",qualification:"qualified",whySelected:"Relevant experience.",subject:"A question",body:"Fixture body",wordCount:75,factIds:[],catalogVersion:"catalog-v4-dylan-voice-v1",snapshotId:"snapshot",blockedReason,operation:{operationId:"operation",snapshot:{} as never,provider:"gmail",state:"gmail-draft-created",gmailDraftId:"draft",gmailMessageId:"message",attemptStartedAt:null,completedAt:null,errorCategory:null,adapterVersion:"fixture",outreachTrack:"professional",sendState:"not-sent",sentAt:null,gmailSentMessageId:null}});

describe("Gmail send gates",()=>{
  it("allows only a created, not-yet-sent draft with every mutable and runtime gate clear",()=>{expect(gmailSendBlockReason(review("existing-gmail-draft"),ready)).toBeNull();});
  it.each(["suppressed","opted-out","previous-contact","company-cooldown"])("blocks the mutable %s gate",(reason)=>{expect(gmailSendBlockReason(review(reason),ready)).toBe(reason);});
  it("blocks missing drafts and runtime readiness failures",()=>{expect(gmailSendBlockReason({...review(),operation:null},ready)).toBe("gmail-send-draft-unavailable");expect(gmailSendBlockReason(review(),{available:false,reason:"gmail-scope-invalid"})).toBe("gmail-scope-invalid");});
  it("requires reconciliation for in-flight or uncertain sends",()=>{for(const sendState of ["sending","send-status-uncertain"] as const)expect(gmailSendBlockReason({...review(),operation:{...review().operation!,sendState}},ready)).toBe("gmail-send-reconciliation-required");});
});
