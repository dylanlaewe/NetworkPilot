import{fragmentById}from"./facts";import type{DraftTemplate,OutreachLane}from"./types";
export const TEMPLATE_CATALOG_VERSION="catalog-v9-dylan-outreach-method-v4";
type VariantSeed=Pick<DraftTemplate,"variantId"|"structure"|"subject"|"reason"|"question"|"fragmentIds">;
const variants=(laneId:OutreachLane,displayName:string,seeds:VariantSeed[]):DraftTemplate[]=>seeds.map((seed)=>{const factIds=[...new Set(seed.fragmentIds.flatMap((id)=>fragmentById(id).factIds))];return{...seed,id:`${laneId}-${seed.variantId}`,laneId,displayName:`${displayName}: ${seed.variantId}`,catalogVersion:TEMPLATE_CATALOG_VERSION,version:"9.0.0",factIds};});
const set=(subjects:[string,string,string],fragments:[string,string,string],reasons:[string,string,string],questions:[string,string,string]):VariantSeed[]=>[
 {variantId:"direct-practical",structure:"facts-first",fragmentIds:[fragments[0]],subject:subjects[0],reason:reasons[0],question:questions[0]},
 {variantId:"career-curiosity",structure:"reason-first",fragmentIds:[fragments[1]],subject:subjects[1],reason:reasons[1],question:questions[1]},
 {variantId:"common-ground",structure:"experience-first",fragmentIds:[fragments[2]],subject:subjects[2],reason:reasons[2],question:questions[2]},
];
const quick="Would you have 15 minutes to share which skill you use most often in the role?";
const perspective="If you have 15 minutes, could I ask which experience best prepared you for the role?";
const approach="Would you have 15 minutes to share what you would learn first if you were starting again?";
export const DRAFT_TEMPLATES:DraftTemplate[]=[
 ...variants("data-analytics","Data and analytics",set(
  ["Quick question about data and analytics","Question about analytics at {{company}}","Building toward stronger data work"],
  ["compact-data-context","compact-systems-context","compact-data-context"],
  ["I’m trying to understand how strong analysts build toward deeper data engineering responsibility.","The transition from reporting and analysis into more technical data work is the part I’m most curious about.","I’d value a practical view of which skills actually matter once the work moves beyond dashboards."],
  [quick,perspective,"Would you be open to a quick 15-minute call about the experiences that helped you grow in this area?"],
 )),
 ...variants("engineering-technical","Engineering and technical",set(
  ["Quick question about engineering work","Technical career question","Question about engineering at {{company}}"],
  ["compact-technical-context","compact-systems-context","compact-technical-context"],
  ["I’m trying to get clearer on what helps someone with a data-heavy background become useful on a broader engineering team.","The move from integrations and automation into deeper software work is the path I’m trying to understand.","I’m especially interested in which early technical experiences translate best to production engineering."],
  [quick,perspective,approach],
 )),
 ...variants("product-management","Product management",set(
  ["Technical product question","Question about product at {{company}}","Moving from technical work into product"],
  ["product-transition-build","product-transition-people","product-transition-frontier"],
  ["I’m exploring how to turn that interest into a first product role.","I’d like to build on those interests in a first product role.","I’d like to understand how to make that move into product."],
  ["Would you have 15 minutes to share what helped you break into product?","If you have 15 minutes, what would you build or learn first to make that move?","Would you have 15 minutes to discuss how technical experience can translate into a first product role?"],
 )),
 ...variants("project-operations","Project, program, and operations",set(
  ["Quick question about technical delivery","Question about program work at {{company}}","Building stronger operations experience"],
  ["delivery-transition-context","compact-business-context","compact-technical-context"],
  ["I’m exploring how to make that move into project or program management.","I’ve enjoyed organizing technical work and would like to move toward coordinating projects across teams.","I’m interested in turning that hands-on work into a role with more responsibility for planning and coordinating execution."],
  [quick,perspective,approach],
 )),
 ...variants("consulting","Consulting",set(
  ["Quick question about consulting","Question about consulting at {{company}}","From technical work into consulting"],
  ["compact-business-context","compact-systems-context","compact-business-context"],
  ["I’m exploring consulting because I like turning analysis into practical decisions, and I’d like to understand how to enter the field.","I’m interested in moving into consulting, especially work that connects analysis with implementation and client decisions.","I’d like to move from technical work into consulting and understand how to position that background for a first role."],
  [quick,perspective,approach],
 )),
 ...variants("finance","Finance",set(
  ["Quick question about financial data work","Question about analytics at {{company}}","Data and technology in finance"],
  ["compact-data-context","compact-business-context","compact-systems-context"],
  ["I’m increasingly interested in how data informs investment and commercial decisions, and I’d like to understand how to enter finance.","I’m exploring finance as a next step and trying to understand where a technical background is useful in a first role.","I’d like to move toward financial analysis and understand which experience would help me make that transition."],
  [quick,perspective,approach],
 )),
 ...variants("commodities-energy","Commodities and energy",set(
  ["Quick question about energy analytics","Question about data at {{company}}","Data work in commodities and energy"],
  ["compact-data-context","compact-business-context","compact-systems-context"],
  ["I’m increasingly interested in how data shapes market and operating decisions, and I’d like to find a way into energy or commodities.","I’m exploring commodities and energy because I’d like to connect technical work with how markets and physical operations interact.","I’d like to move from building data systems into a commercial role and understand how to get started."],
  [quick,perspective,approach],
 )),
 ...variants("defense-technology","Defense and technology",set(
  ["Quick question about technical defense work","Question about engineering at {{company}}","Building useful experience in defense technology"],
  ["compact-technical-context","compact-systems-context","compact-business-context"],
  ["I’m curious how you got started working on these systems and which skills helped you on your first projects.","I’d like to learn how your team tests changes when reliability matters as much as getting the work done.","I’d value a grounded view of how someone early in their career can contribute well in this environment."],
  [quick,perspective,approach],
 )),
 ...variants("career-path-leader","Career path",set(
  ["Quick career question","Question about taking on larger projects","Building a strong technical foundation"],
  ["compact-technical-context","compact-systems-context","compact-business-context"],
  ["I’m focused on becoming a strong contributor first and would value your view on which foundations matter most.","I’m curious how you started taking on larger projects while still staying involved in the technical work.","I’m trying to choose a first role where I can build useful skills and gradually take on larger projects."],
  [quick,perspective,approach],
 )),
];
