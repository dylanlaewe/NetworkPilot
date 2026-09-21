import {describe,expect,it} from "vitest";
import type {CommandCenterDraftReview} from "@/application/command-center-drafts";
import type {GmailDraftOperation} from "@/application/email-drafts";
import type {SimpleDraft} from "@/application/product-workflow";
import {buildWorkspaceDrafts,workspacePrimaryBlockReason} from "./workspace-data";

const baseReview:CommandCenterDraftReview={
  outreachTrack:"professional",candidateId:"candidate-1",recipient:"Current Name",recipientEmail:"private@example.test",company:"Current Company",companyId:"company-1",title:"Current Role",primaryFunction:"product-management",secondaryFunctions:[],persona:"senior",experience:8,industry:"technology",location:"New York",score:92,lane:"product-management",templateVariant:"direct",qualification:"qualified",whySelected:"selected-by-targeting-rank",subject:"Current subject",body:"Current body",wordCount:2,factIds:["fact-1"],catalogVersion:"catalog-current",snapshotId:"snapshot-current",operation:null,blockedReason:null,
  outreachIntent:{version:"outreach-intent-v1",intent:"career-transition",reason:"Understand the path into product leadership",evidenceReferences:[]},
};

function operation(state:GmailDraftOperation["state"]):GmailDraftOperation{
  return{operationId:"operation-1",provider:"gmail",state,gmailDraftId:state==="gmail-draft-created"?"secret-gmail-draft-id":null,gmailMessageId:null,attemptStartedAt:null,completedAt:null,errorCategory:null,adapterVersion:"fixture",sendState:"not-sent",gmailSentMessageId:null,sentAt:null,snapshot:{snapshotId:"immutable-snapshot",recipientProfessionalEmail:"immutable@example.test",recipientDisplayName:"Immutable Name",subject:"Immutable subject",body:"Immutable body",planningSnapshotId:"planning-1",templateCatalogVersion:"catalog-locked",evidenceIds:["fact-a","fact-b"],approvedAt:"2026-09-20T12:00:00.000Z",outreachTrack:"professional",candidateId:"candidate-1",companyId:"company-1",companyDisplayName:"Immutable Company",professionalTitle:"Immutable Role"}};
}

describe("Drafts workspace projection",()=>{
  it("projects reviewable content without exposing professional email or provider identifiers",()=>{
    const [draft]=buildWorkspaceDrafts({rows:[{review:baseReview,state:"ready",primaryAction:"review-and-approve"}],outreach:[],readiness:{available:true,reason:null}});
    expect(draft).toMatchObject({recipient:"Current Name",company:"Current Company",subject:"Current subject",state:"ready",intent:"Understand the path into product leadership"});
    expect(JSON.stringify(draft)).not.toMatch(/private@example|gmailDraftId|recipientEmail/i);
  });

  it.each(["approved","gmail-draft-created","needs-send-verification"] as const)("uses the immutable approved snapshot for %s content",(state)=>{
    const sendState=state==="needs-send-verification"?"send-status-uncertain":"not-sent";
    const op={...operation(state==="approved"?"approved-for-gmail-draft":"gmail-draft-created"),sendState} satisfies GmailDraftOperation;
    const row={review:{...baseReview,operation:op},state,primaryAction:state==="approved"?"create-gmail-draft":state==="gmail-draft-created"?"send-email":"verify-send"} satisfies SimpleDraft;
    const [draft]=buildWorkspaceDrafts({rows:[row],outreach:[],readiness:{available:true,reason:null}});
    expect(draft).toMatchObject({recipient:"Immutable Name",company:"Immutable Company",title:"Immutable Role",subject:"Immutable subject",body:"Immutable body",catalogVersion:"catalog-locked",factCount:2});
    expect(JSON.stringify(draft)).not.toMatch(/immutable@example|secret-gmail-draft-id/);
  });

  it("translates mutable and runtime gates into operator-facing reasons",()=>{
    const op=operation("gmail-draft-created"),review={...baseReview,operation:op,blockedReason:"company-cooldown"};
    const [draft]=buildWorkspaceDrafts({rows:[{review,state:"gmail-draft-created",primaryAction:"send-email"}],outreach:[],readiness:{available:false,reason:"gmail-connection-invalid"}});
    expect(draft?.blockedMessage).toContain("company");
    expect(draft?.sendBlockedMessage).toContain("contacted recently");
  });

  it("uses one truthful primary-action gate for the dock and command palette",()=>{
    const ready=buildWorkspaceDrafts({rows:[{review:{...baseReview,blockedReason:"company-cooldown"},state:"ready",primaryAction:"review-and-approve"}],outreach:[],readiness:{available:true,reason:null}})[0]!;
    const approved=buildWorkspaceDrafts({rows:[{review:{...baseReview,operation:operation("approved-for-gmail-draft")},state:"approved",primaryAction:"create-gmail-draft"}],outreach:[],readiness:{available:true,reason:null}})[0]!;
    const created=buildWorkspaceDrafts({rows:[{review:{...baseReview,operation:operation("gmail-draft-created")},state:"gmail-draft-created",primaryAction:"send-email"}],outreach:[],readiness:{available:false,reason:"gmail-connection-invalid"}})[0]!;
    expect(workspacePrimaryBlockReason(null,true,null)).toBe("Select a draft first.");
    expect(workspacePrimaryBlockReason(ready,true,null)).toContain("company");
    expect(workspacePrimaryBlockReason(approved,false,"Connect Gmail before creating a draft.")).toBe("Connect Gmail before creating a draft.");
    expect(workspacePrimaryBlockReason(approved,true,null)).toBeNull();
    expect(workspacePrimaryBlockReason(created,false,"ignored for sending")).not.toBeNull();
  });
});
