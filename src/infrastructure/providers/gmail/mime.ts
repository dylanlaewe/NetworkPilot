import type {ApprovedEmailDraftSnapshot} from "@/application/email-drafts";

const CRLF="\r\n";
const headerSafe=(value:string,name:string)=>{if(/[\r\n\0]/.test(value))throw new Error(`gmail-mime-header-injection:${name}`);return value.trim();};
const validEmail=(value:string)=>{const email=headerSafe(value,"recipient"),parts=email.split("@");if(email.length>254||parts.length!==2||!parts[0]||!parts[1]?.includes(".")||/\s/.test(email)||["<",">","(",")",",",";",":",'"',"[","]","\\"].some((character)=>email.includes(character)))throw new Error("gmail-mime-recipient-invalid");return email;};
const encodedWord=(value:string)=>/^[\x20-\x7E]*$/.test(value)?value:`=?UTF-8?B?${Buffer.from(value,"utf8").toString("base64")}?=`;
const base64Url=(value:string)=>Buffer.from(value,"utf8").toString("base64url");

export class DeterministicPlainTextMimeBuilder{
  build(snapshot:ApprovedEmailDraftSnapshot):string{
    const email=validEmail(snapshot.recipientProfessionalEmail),display=headerSafe(snapshot.recipientDisplayName,"display-name"),subject=headerSafe(snapshot.subject,"subject");
    if(!subject)throw new Error("gmail-mime-subject-required");
    const normalizedBody=snapshot.body.replace(/\r?\n/g,CRLF);
    if(/\0/.test(normalizedBody))throw new Error("gmail-mime-body-invalid");
    const to=display?`${encodedWord(display)} <${email}>`:email;
    return base64Url([`To: ${to}`,`Subject: ${encodedWord(subject)}`,"MIME-Version: 1.0",'Content-Type: text/plain; charset="UTF-8"',"Content-Transfer-Encoding: 8bit","",normalizedBody].join(CRLF));
  }
}
