import {getDashboardData} from "@/application/simulation/dashboard";
import {NetworkCommandShell} from "@/app/network-command-shell";
import {APOLLO_ADAPTER_VERSION,readApolloConfig} from "@/infrastructure/providers/apollo";
import {loadDailyCommandCenter} from "@/infrastructure/sqlite/daily-command-center";
import {getSimulationRepository} from "@/infrastructure/sqlite/runtime";
import {runTodaySimulation} from "./actions";
import {ReadySimulationControl,SimulationUnavailableControl} from "./simulation-control";
import styles from "./system-command.module.css";
import {isDemoMode} from "@/demo/mode";
import {DEMO_RELATIONSHIPS} from "@/demo/network-command-c3";
import {buildDailyCommandCenter} from "@/application/daily-command-center";
export const dynamic="force-dynamic";

const tone=(healthy:boolean)=>healthy?styles.healthy:styles.attention;
export default async function Home({searchParams}:{searchParams?:Promise<{fixture?:string}>}={}){
  const params:{fixture?:string}=await(searchParams??Promise.resolve({})),demo=isDemoMode(),fixture=demo?params.fixture:undefined,repository=demo?null:getSimulationRepository();
  const simulation=repository?getDashboardData(repository,new Date()):{today:"2026-09-21",timezone:"America/New_York",prospectCount:120,suppressionCount:2,simulationReady:true,latestRun:null};
  const daily=demo?buildDailyCommandCenter({drafts:DEMO_RELATIONSHIPS,reserve:[],gmailState:fixture==="gmail"?"reauthorization-required":"connected",apolloEnabled:true,apolloReady:true,apolloExposure:fixture==="apollo"?20:7,apolloObserved:fixture==="apollo"?20:7,cooldownCompanies:3}):loadDailyCommandCenter(),apollo=readApolloConfig(process.env);
  const gmailReady=daily.safety.gmailState==="connected",apolloExhausted=daily.safety.apolloExposure>=20,databaseReady=simulation.simulationReady;
  const overall=gmailReady&&databaseReady?"Operational":"Action required";
  return <NetworkCommandShell current="system" status={`System · ${overall}`}><div className={styles.page}>
    <header className={styles.header}><div><p>Quiet operational diagnostics</p><h1>System</h1><span>Healthy systems recede. Exceptions stay visible and actionable.</span></div><strong className={tone(overall==="Operational")}>{overall}</strong></header>
    <section className={styles.summary} aria-labelledby="health-summary"><header><h2 id="health-summary">Health</h2><span>Local production</span></header><dl>
      <div className={tone(gmailReady)}><dt><i/>Gmail</dt><dd><strong>{gmailReady?"Ready":"Connection needs attention"}</strong><span>{gmailReady?"Compose access is connected.":"Reconnect before creating or sending approved drafts."}</span></dd></div>
      <div className={tone(!apolloExhausted)}><dt><i/>Apollo</dt><dd><strong>{apolloExhausted?"Available tomorrow":`${Math.max(0,20-daily.safety.apolloExposure)} refresh credits available`}</strong><span>{apolloExhausted?"Candidate refresh is paused; other workflows remain available.":"Bounded read-only sourcing is available when explicitly requested."}</span></dd></div>
      <div className={tone(databaseReady)}><dt><i/>Data</dt><dd><strong>{databaseReady?"Healthy":"Fictional dataset unavailable"}</strong><span>{simulation.prospectCount} fictional simulation prospects · persistent local storage</span></dd></div>
      <div className={styles.healthy}><dt><i/>Safety</dt><dd><strong>Guards active</strong><span>{daily.safety.suppressed} suppressed · {daily.safety.cooldownCompanies} companies cooling down</span></dd></div>
    </dl></section>
    <section className={styles.groups}>
      <details open><summary><span>Gmail</span><strong>{gmailReady?"Ready":"Review"}</strong></summary><div><p>Draft and explicit approved-draft sending only. Mailbox reading, bulk sending, scheduling, and SMTP are unavailable.</p>{!gmailReady?<a href="/gmail/reconnect">Reconnect Gmail</a>:null}</div></details>
      <details><summary><span>Apollo</span><strong>{apolloExhausted?"Exhausted":"Available"}</strong></summary><div><dl><div><dt>Adapter</dt><dd>{APOLLO_ADAPTER_VERSION}</dd></div><div><dt>Authorized exposure today</dt><dd>{daily.safety.apolloExposure}</dd></div><div><dt>Observed credits</dt><dd>{daily.safety.apolloObserved??"Not reported"}</dd></div><div><dt>Configuration</dt><dd>{apollo.enabled?"Enabled":"Disabled"}</dd></div></dl><p>Apollo read-only adapter · {apollo.enabled?"controlled access enabled":"no live access validated"}. No provider action is available in this interface.</p></div></details>
      <details><summary><span>Data & migrations</span><strong>{databaseReady?"Healthy":"Review"}</strong></summary><div><dl><div><dt>Campaign date</dt><dd>{simulation.today}</dd></div><div><dt>Timezone</dt><dd>{simulation.timezone}</dd></div><div><dt>Simulation dataset</dt><dd>{simulation.prospectCount} records</dd></div><div><dt>Suppressions</dt><dd>{simulation.suppressionCount}</dd></div></dl></div></details>
      <details><summary><span>Safety boundaries</span><strong>Active</strong></summary><div><p>Provider credentials and tokens are never displayed. Suppression, cooldown, immutable approval, and explicit-send gates remain enforced.</p></div></details>
      <details><summary><span>Simulation utilities</span><strong>Developer</strong></summary><div><p>Fictional campaign simulation is isolated from the private production outreach workspace. Strategy aliases are exercises, not an employment claim.</p>{demo?<p>Demo mode keeps simulation controls read-only.</p>:simulation.simulationReady?<ReadySimulationControl action={runTodaySimulation} existing={Boolean(simulation.latestRun)}/>:<SimulationUnavailableControl/>}</div></details>
    </section>
  </div></NetworkCommandShell>;
}
