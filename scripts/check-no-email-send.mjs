import {readFileSync,readdirSync,statSync} from "node:fs";
import {join,relative,resolve} from "node:path";

const roots=[resolve(process.cwd(),"src"),resolve(process.cwd(),"scripts")],files=[];
const visit=(directory)=>{for(const name of readdirSync(directory)){const path=join(directory,name),stat=statSync(path);if(stat.isDirectory())visit(path);else if(/\.(ts|tsx|js|mjs)$/.test(name)&&!name.includes(".test.")&&name!=="check-no-email-send.mjs")files.push(path);}};
for(const root of roots)visit(root);
const approvedDraftSendFile="src/infrastructure/providers/gmail/adapter.ts",approvedDraftSend='path:"/gmail/v1/users/me/drafts/'+'send"';
const forbidden=["/messages/"+"send",".messages."+"send","nodemailer","send"+"Mail(","smtp"+"Transport","apollo"+" sequence","schedule"+"Send","bulk"+"Send"];
const violations=[];
for(const file of files){const relativeFile=relative(process.cwd(),file),raw=readFileSync(file,"utf8"),source=raw.toLowerCase();for(const pattern of forbidden)if(source.includes(pattern.toLowerCase()))violations.push(`${relativeFile}: ${pattern}`);if(source.includes(("/drafts/"+"send").toLowerCase())&&(relativeFile!==approvedDraftSendFile||!raw.includes(approvedDraftSend)))violations.push(`${relativeFile}: unauthorized Gmail draft send path`);}
const adapter=readFileSync(resolve(process.cwd(),approvedDraftSendFile),"utf8");if(adapter.split(approvedDraftSend).length!==2)violations.push(`${approvedDraftSendFile}: expected exactly one approved drafts.send boundary`);
if(violations.length){console.error(`Email-send boundary violation:\n${violations.join("\n")}`);process.exit(1);}
console.log("Email-send check passed: only explicit approved Gmail drafts.send is available; bulk, scheduled, SMTP, and messages.send paths are absent.");
