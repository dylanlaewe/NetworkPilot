export const DEMO_MODE_ENV="NETWORKPILOT_DEMO_MODE" as const;
export const DEMO_PROFILE={name:"Alex Morgan",summary:"Recent computer science graduate with project experience in data workflows and automation."} as const;
export function isDemoMode(env:Readonly<Record<string,string|undefined>>=process.env){return env[DEMO_MODE_ENV]==="true";}
export function assertLiveProvidersAllowed(envOrProvider:Readonly<Record<string,string|undefined>>|string=process.env){const env=typeof envOrProvider==="string"?process.env:envOrProvider;if(isDemoMode(env))throw new Error("demo-mode-live-providers-prohibited");}
export class DemoGmailProvider{readonly kind="deterministic-demo";async createDraft(){return{draftId:"demo-draft-001",messageId:"demo-message-001"};}async sendDraft(){return{messageId:"demo-sent-001"};}}
export class DemoApolloProvider{readonly kind="deterministic-demo";async search(){return{records:[],totalAvailable:0};}}
export const DEMO_FIXTURE={companies:["Northstar Systems","Harbor Analytics","Pioneer Works"],recipients:["Avery Chen","Jordan Reed","Casey Patel"],emails:["avery@example.invalid","jordan@example.invalid","casey@example.invalid"]} as const;
