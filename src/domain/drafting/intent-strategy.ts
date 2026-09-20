import {fragmentById} from "./facts";
import type {DraftTemplate} from "./types";
import type {IntentSelection} from "./outreach-intent";

// Intent changes copy only. It never changes recipient classification or qualification.
export function applyIntentStrategy(template:DraftTemplate,selection:IntentSelection):DraftTemplate{
  let result={...template,outreachIntent:selection};
  if(selection.intent==="career-transition"){
    const i=template.variantId==="direct-practical"?0:template.variantId==="career-curiosity"?1:2;
    const questions:Partial<Record<DraftTemplate["laneId"],string[]>>={
      "project-operations":["Would you have 15 minutes to share how you moved into leading projects?","If you have 15 minutes, which early experience would you recommend for moving into program management?","Would you have 15 minutes to discuss how technical experience can lead to a first project role?"],
      finance:["Would you have 15 minutes to share where someone with a technical background could start in finance?","If you have 15 minutes, which experience would help me make the move into financial work?","Would you have 15 minutes to discuss how you’d position a data background for a first finance role?"],
      "commodities-energy":["Would you have 15 minutes to share how someone with a data background could break into this field?","If you have 15 minutes, which skills would you build first before applying for energy or commodities roles?","Would you have 15 minutes to discuss which first roles connect technical work with market decisions?"],
      consulting:["Would you have 15 minutes to share how you’d approach breaking into consulting from a technical role?","If you have 15 minutes, which early experience would you recommend before applying to consulting teams?","Would you have 15 minutes to discuss how you’d position a data background for a first consulting role?"],
    };
    if(questions[template.laneId])result={...result,question:questions[template.laneId]![i]};
  }
  if(selection.intent==="experience-forward"&&["finance","commodities-energy","consulting","project-operations"].includes(template.laneId)){
    const i=template.variantId==="direct-practical"?0:template.variantId==="career-curiosity"?1:2;
    const contexts=["compact-business-context","compact-systems-context","compact-data-context"];
    const reasons=template.laneId==="consulting"
      ?["I’m interested in how analysts turn technical work into recommendations people can actually use.","I’d like to learn how your team connects analysis with the decisions a client needs to make.","I’m curious which parts of hands-on data work have been most useful in your consulting projects."]
      :["I’d like to build on that experience and understand how you approach data work in your field.","I’m interested in how you approach larger data projects that build on reporting and integration work.","I’d like to understand which of my current technical skills would be most useful on a team like yours."];
    const questions=["Would you have 15 minutes to share which skill you use most often in the role?","If you have 15 minutes, could I ask how you took on your first larger data project?","Would you have 15 minutes to share what you’d focus on next with a background like mine?"];
    const fragmentIds=[contexts[i]],factIds=[...new Set(fragmentIds.flatMap(id=>fragmentById(id).factIds))];
    result={...result,fragmentIds,factIds,reason:reasons[i],question:questions[i]};
  }
  return result;
}
