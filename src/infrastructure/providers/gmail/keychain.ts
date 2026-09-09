import {execFile} from "node:child_process";
import {promisify} from "node:util";
import type {GoogleTokenSecretStore,StoredGoogleTokens} from "./oauth";

const execute=promisify(execFile),SERVICE="com.networkpilot.gmail-oauth",ACCOUNT="single-user";
export class MacOsKeychainGoogleTokenStore implements GoogleTokenSecretStore{
  private assertPlatform(){if(process.platform!=="darwin")throw new Error("gmail-secure-token-store-unavailable");}
  async load():Promise<StoredGoogleTokens|null>{this.assertPlatform();try{const {stdout}=await execute("security",["find-generic-password","-s",SERVICE,"-a",ACCOUNT,"-w"],{maxBuffer:64*1024});return JSON.parse(stdout.trim()) as StoredGoogleTokens;}catch(error){const value=error as {code?:number};if(value.code===44)return null;throw new Error("gmail-keychain-read-failed");}}
  async save(tokens:StoredGoogleTokens):Promise<void>{this.assertPlatform();await execute("security",["add-generic-password","-U","-s",SERVICE,"-a",ACCOUNT,"-w",JSON.stringify(tokens)],{maxBuffer:64*1024});}
  async delete():Promise<void>{this.assertPlatform();try{await execute("security",["delete-generic-password","-s",SERVICE,"-a",ACCOUNT],{maxBuffer:64*1024});}catch(error){const value=error as {code?:number};if(value.code!==44)throw new Error("gmail-keychain-delete-failed");}}
}
