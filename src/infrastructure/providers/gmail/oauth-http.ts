import type {GoogleOAuthTransport,StoredGoogleTokens} from "./oauth";

const TOKEN_ENDPOINT="https://oauth2.googleapis.com/token",REVOKE_ENDPOINT="https://oauth2.googleapis.com/revoke";
const parse=async(response:Response)=>{const body=await response.text();if(!response.ok)throw new Error(body.includes("invalid_grant")?"gmail-oauth-invalid_grant":`gmail-oauth-http-${response.status}`);try{return JSON.parse(body) as Record<string,unknown>;}catch{throw new Error("gmail-oauth-response-malformed");}};
const scopes=(value:unknown)=>typeof value==="string"?value.split(/\s+/).filter(Boolean):[];
const tokenFields=(payload:Record<string,unknown>)=>{if(typeof payload.access_token!=="string"||typeof payload.expires_in!=="number")throw new Error("gmail-oauth-response-malformed");return{accessToken:payload.access_token,expiresAt:new Date(Date.now()+payload.expires_in*1000).toISOString(),grantedScopes:scopes(payload.scope),accountEmail:null};};

export class FetchGoogleOAuthTransport implements GoogleOAuthTransport{
  constructor(private readonly fetcher:typeof fetch=fetch){}
  async exchange(input:Parameters<GoogleOAuthTransport["exchange"]>[0]):Promise<StoredGoogleTokens>{const body=new URLSearchParams({client_id:input.clientId,...input.clientSecret?{client_secret:input.clientSecret}:{},code:input.code,code_verifier:input.codeVerifier,redirect_uri:input.redirectUri,grant_type:"authorization_code"}),payload=await parse(await this.fetcher(TOKEN_ENDPOINT,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body,redirect:"error"}));if(typeof payload.refresh_token!=="string")throw new Error("gmail-oauth-refresh-token-missing");return{...tokenFields(payload),refreshToken:payload.refresh_token};}
  async refresh(input:Parameters<GoogleOAuthTransport["refresh"]>[0]){const body=new URLSearchParams({client_id:input.clientId,...input.clientSecret?{client_secret:input.clientSecret}:{},refresh_token:input.refreshToken,grant_type:"refresh_token"}),payload=await parse(await this.fetcher(TOKEN_ENDPOINT,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body,redirect:"error"}));return tokenFields(payload);}
  async revoke(accessToken:string):Promise<void>{const response=await this.fetcher(REVOKE_ENDPOINT,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({token:accessToken}),redirect:"error"});if(!response.ok)throw new Error(`gmail-oauth-revoke-${response.status}`);}
}
