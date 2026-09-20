import {createHash} from "node:crypto";
import {existsSync,mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {basename,resolve,sep} from "node:path";

export const DEFAULT_RESUME_STORAGE_PATH="data/resumes";
export class LocalResumeStore{
  readonly root:string;
  constructor(path=process.env.NETWORKPILOT_RESUME_STORAGE_PATH??DEFAULT_RESUME_STORAGE_PATH){this.root=resolve(path);}
  private path(storageKey:string){
    if(storageKey!==basename(storageKey)||!/^[a-f0-9]{64}\.pdf$/.test(storageKey))throw new Error("resume-storage-key-invalid");
    const target=resolve(this.root,storageKey);if(!target.startsWith(`${this.root}${sep}`))throw new Error("resume-storage-path-invalid");return target;
  }
  store(storageKey:string,bytes:Uint8Array){mkdirSync(this.root,{recursive:true,mode:0o700});const target=this.path(storageKey);if(existsSync(target)){if(!Buffer.from(readFileSync(target)).equals(Buffer.from(bytes)))throw new Error("resume-storage-hash-conflict");return;}writeFileSync(target,bytes,{flag:"wx",mode:0o600});}
  read(input:{storageKey:string;sha256:string;sizeBytes:number}):Uint8Array{const bytes=readFileSync(this.path(input.storageKey));if(bytes.byteLength!==input.sizeBytes||createHash("sha256").update(bytes).digest("hex")!==input.sha256)throw new Error("resume-storage-integrity-failed");return bytes;}
}
