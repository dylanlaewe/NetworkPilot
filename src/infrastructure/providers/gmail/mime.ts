import type {ApprovedEmailDraftSnapshot} from "@/application/email-drafts";
import {createHash} from "node:crypto";

const CRLF="\r\n";
const headerSafe=(value:string,name:string)=>{if(/[\r\n\0]/.test(value))throw new Error(`gmail-mime-header-injection:${name}`);return value.trim();};
const validEmail=(value:string)=>{const email=headerSafe(value,"recipient"),parts=email.split("@");if(email.length>254||parts.length!==2||!parts[0]||!parts[1]?.includes(".")||/\s/.test(email)||["<",">","(",")",",",";",":",'"',"[","]","\\"].some((character)=>email.includes(character)))throw new Error("gmail-mime-recipient-invalid");return email;};
const encodedWord=(value:string)=>/^[\x20-\x7E]*$/.test(value)?value:`=?UTF-8?B?${Buffer.from(value,"utf8").toString("base64")}?=`;
const base64Url=(value:string)=>Buffer.from(value,"utf8").toString("base64url");
const wrappedBase64=(value:Uint8Array)=>Buffer.from(value).toString("base64").match(/.{1,76}/g)?.join(CRLF)??"";

export interface ResumeAttachmentReader {read(input:{storageKey:string;sha256:string;sizeBytes:number}):Uint8Array;}

export class DeterministicPlainTextMimeBuilder{
  constructor(private readonly attachments?:ResumeAttachmentReader){}
  build(snapshot:ApprovedEmailDraftSnapshot):string{
    const email=validEmail(snapshot.recipientProfessionalEmail),display=headerSafe(snapshot.recipientDisplayName,"display-name"),subject=headerSafe(snapshot.subject,"subject");
    if(!subject)throw new Error("gmail-mime-subject-required");
    const normalizedBody=snapshot.body.replace(/\r?\n/g,CRLF);
    if(/\0/.test(normalizedBody))throw new Error("gmail-mime-body-invalid");
    const to=display?`${encodedWord(display)} <${email}>`:email;
    if(!snapshot.resumeAttachment)return base64Url([`To: ${to}`,`Subject: ${encodedWord(subject)}`,"MIME-Version: 1.0",'Content-Type: text/plain; charset="UTF-8"',"Content-Transfer-Encoding: 8bit","",normalizedBody].join(CRLF));
    if(!this.attachments)throw new Error("gmail-mime-attachment-reader-required");
    const attachment=snapshot.resumeAttachment,filename=headerSafe(attachment.filename,"attachment-filename");
    if(!filename.toLowerCase().endsWith(".pdf"))throw new Error("gmail-mime-attachment-invalid");
    const bytes=this.attachments.read(attachment),hash=createHash("sha256").update(bytes).digest("hex");
    if(hash!==attachment.sha256||bytes.byteLength!==attachment.sizeBytes)throw new Error("gmail-mime-attachment-integrity-failed");
    const boundary=`networkpilot_${createHash("sha256").update(`${snapshot.snapshotId}:${attachment.sha256}`).digest("hex").slice(0,32)}`;
    const message=[`To: ${to}`,`Subject: ${encodedWord(subject)}`,"MIME-Version: 1.0",`Content-Type: multipart/mixed; boundary="${boundary}"`,"",`--${boundary}`,'Content-Type: text/plain; charset="UTF-8"',"Content-Transfer-Encoding: 8bit","",normalizedBody,`--${boundary}`,`Content-Type: application/pdf; name="${filename}"`,"Content-Transfer-Encoding: base64",`Content-Disposition: attachment; filename="${filename}"`,"",wrappedBase64(bytes),`--${boundary}--`,""].join(CRLF);
    return base64Url(message);
  }
}
