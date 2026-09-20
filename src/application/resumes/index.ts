import {createHash,randomUUID} from "node:crypto";
import type {ResumeAttachmentSnapshot,ResumeRecord,ResumeRepository,ResumeRoleLane} from "./types";
import {RESUME_ROLE_LANES} from "./types";

export * from "./types";
export const MAX_RESUME_BYTES=10*1024*1024;

export function sanitizePdfFilename(value:string):string{
  const leaf=value.replaceAll("\\","/").split("/").at(-1)??"resume.pdf";
  const stem=leaf.replace(/\.pdf$/i,"").normalize("NFKD").replace(/[^a-zA-Z0-9._ -]/g,"").replace(/\.{2,}/g,".").replace(/\s+/g," ").trim().replace(/^\.+/,"").slice(0,100)||"resume";
  return `${stem}.pdf`;
}

export function validateResumePdf(input:{filename:string;bytes:Uint8Array}):{safeFilename:string;sha256:string}{
  if(!/\.pdf$/i.test(input.filename))throw new Error("resume-pdf-extension-required");
  if(input.bytes.byteLength===0)throw new Error("resume-pdf-empty");
  if(input.bytes.byteLength>MAX_RESUME_BYTES)throw new Error("resume-pdf-too-large");
  if(Buffer.from(input.bytes.subarray(0,5)).toString("ascii")!=="%PDF-")throw new Error("resume-pdf-signature-invalid");
  return{safeFilename:sanitizePdfFilename(input.filename),sha256:createHash("sha256").update(input.bytes).digest("hex")};
}

export function addResume(input:{repository:ResumeRepository;store:(storageKey:string,bytes:Uint8Array)=>void;filename:string;bytes:Uint8Array;displayLabel:string;roleLane:ResumeRoleLane|null;now:()=>Date;id?:string}):ResumeRecord{
  const label=input.displayLabel.trim();if(!label||label.length>80)throw new Error("resume-label-invalid");
  if(input.roleLane!==null&&!RESUME_ROLE_LANES.includes(input.roleLane))throw new Error("resume-role-lane-invalid");
  const {safeFilename,sha256}=validateResumePdf(input),storageKey=`${sha256}.pdf`;
  input.store(storageKey,input.bytes);
  const record:ResumeRecord={id:input.id??`resume-${randomUUID()}`,displayLabel:label,originalFilename:safeFilename,storageKey,sizeBytes:input.bytes.byteLength,sha256,uploadedAt:input.now().toISOString(),roleLane:input.roleLane,active:true};
  input.repository.saveResume(record);return record;
}

export function attachmentSnapshot(record:ResumeRecord):ResumeAttachmentSnapshot{
  if(!record.active)throw new Error("resume-inactive");
  return{resumeId:record.id,displayLabel:record.displayLabel,filename:record.originalFilename,storageKey:record.storageKey,sizeBytes:record.sizeBytes,sha256:record.sha256};
}

export function suggestedResumeId(input:{track:"professional"|"recruiter";lane:string;resumes:readonly ResumeRecord[]}):string|null{
  if(input.track==="professional")return null;
  const desired=input.lane==="product-management"?"product":input.lane==="engineering-technical"?"software":input.lane==="data-analytics"||input.lane==="recruiter"?"data-analytics":null;
  return input.resumes.find(item=>item.active&&item.roleLane===desired)?.id??input.resumes.find(item=>item.active&&item.roleLane==="general")?.id??null;
}
