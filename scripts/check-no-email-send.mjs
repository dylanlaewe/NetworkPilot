import {readFileSync,readdirSync,statSync} from "node:fs";
import {join,relative,resolve} from "node:path";

const root=resolve(process.cwd(),"src"),files=[];
const visit=(directory)=>{for(const name of readdirSync(directory)){const path=join(directory,name),stat=statSync(path);if(stat.isDirectory())visit(path);else if(/\.(ts|tsx|js|mjs)$/.test(name)&&!name.includes(".test."))files.push(path);}};
visit(root);
const forbidden=["/drafts/"+"send","/messages/"+"send",".drafts."+"send",".messages."+"send","nodemailer","send"+"Mail(","smtp"+"Transport","apollo"+" sequence"];
const violations=[];
for(const file of files){const source=readFileSync(file,"utf8").toLowerCase();for(const pattern of forbidden)if(source.includes(pattern.toLowerCase()))violations.push(`${relative(process.cwd(),file)}: ${pattern}`);}
if(violations.length){console.error(`Email-send boundary violation:\n${violations.join("\n")}`);process.exit(1);}
console.log("Email-send check passed: application source contains no known delivery path.");
