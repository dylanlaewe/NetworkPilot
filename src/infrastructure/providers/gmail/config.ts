import {GMAIL_COMPOSE_SCOPE} from "@/application/email-drafts";

export interface GmailConfig {enabled:boolean;clientId?:string;clientSecret?:string;redirectUri?:string;scope:typeof GMAIL_COMPOSE_SCOPE;timeoutMs:number;maxResponseBytes:number;}

const positiveInteger=(value:string|undefined,fallback:number,name:string)=>{const parsed=value===undefined?fallback:Number(value);if(!Number.isInteger(parsed)||parsed<=0)throw new Error(`gmail-config-invalid:${name}`);return parsed;};

export function readGmailConfig(environment:Record<string,string|undefined>):GmailConfig{
  const enabled=environment.NETWORKPILOT_GMAIL_ENABLED==="true",redirectUri=environment.GOOGLE_OAUTH_REDIRECT_URI;
  if(redirectUri&&!/^http:\/\/127\.0\.0\.1:\d+\/oauth\/google\/callback$/.test(redirectUri))throw new Error("gmail-config-invalid:redirect-uri");
  return{enabled,...environment.GOOGLE_OAUTH_CLIENT_ID?.trim()?{clientId:environment.GOOGLE_OAUTH_CLIENT_ID.trim()}: {},...environment.GOOGLE_OAUTH_CLIENT_SECRET?.trim()?{clientSecret:environment.GOOGLE_OAUTH_CLIENT_SECRET.trim()}: {},...redirectUri?{redirectUri}:{},scope:GMAIL_COMPOSE_SCOPE,timeoutMs:positiveInteger(environment.NETWORKPILOT_GMAIL_TIMEOUT_MS,10000,"timeout"),maxResponseBytes:positiveInteger(environment.NETWORKPILOT_GMAIL_MAX_RESPONSE_BYTES,262144,"response-size")};
}

export function assertGmailEnabled(config:GmailConfig):{clientId:string;redirectUri:string}{if(!config.enabled)throw new GmailConfigurationError("gmail-feature-disabled");if(!config.clientId||!config.redirectUri)throw new GmailConfigurationError("gmail-oauth-configuration-missing");return{clientId:config.clientId,redirectUri:config.redirectUri};}
export class GmailConfigurationError extends Error{}
export function redactGmailError(error:unknown,secrets:readonly (string|undefined)[]):string{let value=error instanceof Error?error.message:String(error);for(const secret of secrets)if(secret)value=value.replaceAll(secret,"[REDACTED]");return value;}
