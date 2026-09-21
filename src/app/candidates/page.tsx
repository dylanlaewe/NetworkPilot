import {NetworkCommandShell} from "@/app/network-command-shell";
import {loadDailyCommandCenter} from "@/infrastructure/sqlite/daily-command-center";
import {CandidateRefreshControl} from "./refresh-control";
import {CandidatesWorkspace} from "./candidates-workspace";

export const dynamic="force-dynamic";

export default async function CandidatesPage({searchParams}:{searchParams:Promise<{selected?:string;filters?:string;added?:string;professional?:string;recruiter?:string;companies?:string;credits?:string}>}){
  const data=loadDailyCommandCenter(),params=await searchParams,available=data.reserve.filter((row)=>row.stage==="qualified-available"),showResult=params.added!==undefined;
  const health=data.safety.apolloExposure>=20?"Candidate refresh available tomorrow":`${available.length} candidates available · ${Math.max(0,20-data.safety.apolloExposure)} refresh credits available`;
  const refresh=<CandidateRefreshControl available={data.pipeline.available} exposure={data.safety.apolloExposure}/>;
  const result=showResult?`${params.added} candidates added · ${params.professional} professional · ${params.recruiter} recruiter · ${params.companies} companies · ${params.credits} credits used`:null;
  return <NetworkCommandShell current="candidates" status={health}><CandidatesWorkspace candidates={data.reserve} initialSelectedId={params.selected} initialFilterOpen={params.filters==="open"} refreshControl={refresh} refreshResult={result}/></NetworkCommandShell>;
}
