import {getDashboardData} from "@/application/simulation/dashboard";
import {NetworkCommandShell} from "@/app/network-command-shell";
import {APOLLO_ADAPTER_VERSION,readApolloConfig} from "@/infrastructure/providers/apollo";
import {loadDailyCommandCenter} from "@/infrastructure/sqlite/daily-command-center";
import {openRuntimeRepository} from "@/infrastructure/sqlite/runtime";
import {runTodaySimulation} from "./actions";
import {ReadySimulationControl,SimulationUnavailableControl} from "./simulation-control";
import styles from "./system-command.module.css";
import {isDemoMode} from "@/demo/mode";
import {DEMO_RELATIONSHIPS} from "@/demo/network-command-c3";
import {buildDailyCommandCenter} from "@/application/daily-command-center";
import {explicitMigrationCommand,isDatabaseMigrationRequired,type DatabaseMigrationRequiredError} from "@/infrastructure/sqlite/schema-contract";
import {loadCommandCenterDraftReviews} from "@/infrastructure/sqlite/command-center-drafts";
import {humanDraftError} from "@/application/command-center-drafts";
export const dynamic="force-dynamic";

const tone=(healthy:boolean)=>healthy?styles.healthy:styles.attention;
export default async function Home({searchParams}:{searchParams?:Promise<{fixture?:string}>}={}){
  const params:{fixture?:string}=await(searchParams??Promise.resolve({})),demo=isDemoMode(),fixture=demo?params.fixture:undefined;
  let migrationRequired:DatabaseMigrationRequiredError|null=null,simulation:{today:string;timezone:string;prospectCount:number;suppressionCount:number;simulationReady:boolean;latestRun:ReturnType<typeof getDashboardData>["latestRun"]},daily,gmailReadiness:{available:boolean;reason:string|null};
  if(demo){simulation={today:"2026-09-21",timezone:"America/New_York",prospectCount:120,suppressionCount:2,simulationReady:true,latestRun:null};daily=buildDailyCommandCenter({drafts:DEMO_RELATIONSHIPS,reserve:[],gmailState:fixture==="gmail"?"reauthorization-required":"connected",apolloEnabled:true,apolloReady:true,apolloExposure:fixture==="apollo"?20:7,apolloObserved:fixture==="apollo"?20:7,cooldownCompanies:3});gmailReadiness=fixture==="gmail"?{available:false,reason:"gmail-connection-invalid"}:{available:true,reason:null};}
  else try{const repository=openRuntimeRepository(undefined,{readonly:true});try{simulation=getDashboardData(repository,new Date());}finally{repository.close();}daily=loadDailyCommandCenter();gmailReadiness=(await loadCommandCenterDraftReviews()).gmail.readiness;}catch(error){if(!isDatabaseMigrationRequired(error))throw error;migrationRequired=error;simulation={today:new Date().toISOString().slice(0,10),timezone:"America/New_York",prospectCount:0,suppressionCount:0,simulationReady:false,latestRun:null};daily=buildDailyCommandCenter({drafts:[],reserve:[],gmailState:"not-configured",apolloEnabled:false,apolloExposure:0,apolloObserved:null,cooldownCompanies:0});gmailReadiness={available:false,reason:"gmail-feature-disabled"};}
  const apollo=readApolloConfig(process.env);
  const gmailReady=gmailReadiness.available,gmailDisabled=gmailReadiness.reason==="gmail-feature-disabled",gmailStatus=gmailReady?"Ready":gmailDisabled?"Disabled":"Connection needs attention",gmailDetail=gmailReady?"Compose access is connected.":gmailDisabled?"Gmail draft creation is disabled in this runtime.":humanDraftError(gmailReadiness.reason??"gmail-connection-invalid"),apolloEnabled=daily.safety.apolloEnabled,apolloReady=daily.safety.apolloReady,apolloExhausted=daily.safety.apolloExposure>=20,apolloAvailable=apolloReady&&!apolloExhausted,apolloStatus=!apolloEnabled?"Disabled":!apolloReady?"Configuration needed":apolloExhausted?"Available tomorrow":`${Math.max(0,20-daily.safety.apolloExposure)} refresh credits available`,apolloDetail=!apolloEnabled?"Live Apollo sourcing is disabled in this runtime.":!apolloReady?"Apollo is enabled but its local credential is unavailable.":apolloExhausted?"Candidate refresh is paused; other workflows remain available.":"Bounded read-only sourcing is available when explicitly requested.",databaseReady=simulation.simulationReady;
  const overall=gmailReady&&apolloReady&&databaseReady&&!migrationRequired?"Operational":"Action required";
  return <NetworkCommandShell current="system" status={`Settings · ${overall}`}><div className={styles.page}>
    <header className={styles.header}><div><p>Settings and operational health</p><h1>Settings</h1><span>Healthy systems recede. Exceptions stay visible and actionable.</span></div><strong className={tone(overall==="Operational")}>{overall}</strong></header>
    <section className={styles.summary} aria-labelledby="health-summary"><header><h2 id="health-summary">Health</h2><span>Local production</span></header><dl>
      <div className={tone(gmailReady)}><dt><i/>Gmail</dt><dd><strong>{gmailStatus}</strong><span>{gmailDetail}</span></dd></div>
      <div className={tone(apolloAvailable)}><dt><i/>Apollo</dt><dd><strong>{apolloStatus}</strong><span>{apolloDetail}</span></dd></div>
      <div className={tone(databaseReady&&!migrationRequired)}><dt><i/>Data</dt><dd><strong>{migrationRequired?"Migration required":databaseReady?"Healthy":"Fictional dataset unavailable"}</strong><span>{migrationRequired?<>Review the target, then run <code>{explicitMigrationCommand(migrationRequired.databasePath)}</code> ({migrationRequired.requiredVersion}).</>:`${simulation.prospectCount} fictional simulation prospects · persistent local storage`}</span></dd></div>
      <div className={styles.healthy}><dt><i/>Safety</dt><dd><strong>Guards active</strong><span>{daily.safety.suppressed} suppressed · {daily.safety.cooldownCompanies} companies cooling down</span></dd></div>
    </dl></section>
    <section className={styles.groups}>
      <details open><summary><span>Gmail</span><strong>{gmailStatus}</strong></summary><div><p>{gmailDetail} Mailbox reading, bulk sending, scheduling, and SMTP are unavailable.</p>{!gmailReady&&!gmailDisabled?<a href="/gmail/reconnect">Reconnect Gmail</a>:null}</div></details>
      <details><summary><span>Apollo</span><strong>{apolloStatus}</strong></summary><div><dl><div><dt>Adapter</dt><dd>{APOLLO_ADAPTER_VERSION}</dd></div><div><dt>Authorized exposure today</dt><dd>{daily.safety.apolloExposure}</dd></div><div><dt>Observed credits</dt><dd>{daily.safety.apolloObserved??"Not reported"}</dd></div><div><dt>Configuration</dt><dd>{apollo.enabled?"Enabled":"Disabled"}</dd></div></dl><p>{apolloDetail} No provider action is available in this interface.</p></div></details>
      <details><summary><span>Data & migrations</span><strong>{databaseReady?"Healthy":"Review"}</strong></summary><div><dl><div><dt>Campaign date</dt><dd>{simulation.today}</dd></div><div><dt>Timezone</dt><dd>{simulation.timezone}</dd></div><div><dt>Simulation dataset</dt><dd>{simulation.prospectCount} records</dd></div><div><dt>Suppressions</dt><dd>{simulation.suppressionCount}</dd></div></dl></div></details>
      <details><summary><span>Safety boundaries</span><strong>Active</strong></summary><div><p>Provider credentials and tokens are never displayed. Suppression, cooldown, immutable approval, and explicit-send gates remain enforced.</p></div></details>
      <details><summary><span>Simulation utilities</span><strong>Developer</strong></summary><div><p>Fictional campaign simulation is isolated from the private production outreach workspace. Strategy aliases are exercises, not an employment claim.</p>{demo?<p>Demo mode keeps simulation controls read-only.</p>:simulation.simulationReady?<ReadySimulationControl action={runTodaySimulation} existing={Boolean(simulation.latestRun)}/>:<SimulationUnavailableControl/>}</div></details>
    </section>
  </div></NetworkCommandShell>;
}
