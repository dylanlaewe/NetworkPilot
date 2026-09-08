import type { SimulationRepository } from "@/application/simulation/types";

export function cancelCampaignPlan(repository:SimulationRepository,planId:string,at:Date):void{
  repository.transaction(()=>repository.updateCampaignPlanStatus(planId,"cancelled",at));
}

export function getCampaignPlan(repository:SimulationRepository,planId:string){return repository.findCampaignPlan(planId);}
