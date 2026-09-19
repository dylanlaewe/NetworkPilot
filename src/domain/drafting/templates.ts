import{fragmentById}from"./facts";import type{DraftTemplate,OutreachLane}from"./types";
export const TEMPLATE_CATALOG_VERSION="catalog-v7-dylan-outreach-method-v3";
type VariantSeed=Pick<DraftTemplate,"variantId"|"structure"|"subject"|"reason"|"question"|"fragmentIds">;
const variants=(laneId:OutreachLane,displayName:string,seeds:VariantSeed[]):DraftTemplate[]=>seeds.map((seed)=>{const factIds=[...new Set(seed.fragmentIds.flatMap((id)=>fragmentById(id).factIds))];return{...seed,id:`${laneId}-${seed.variantId}`,laneId,displayName:`${displayName}: ${seed.variantId}`,catalogVersion:TEMPLATE_CATALOG_VERSION,version:"6.0.0",factIds};});
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
  ["compact-product-context","compact-systems-context","compact-product-context"],
  ["I’m trying to understand how technical practitioners move into product without overstating experience they haven’t built yet.","The part I’m most interested in is learning how good product people prioritize useful systems across business and technical constraints.","I’d value a practical perspective on turning technical depth into sound product judgment."],
  ["Would you be open to a quick 15-minute conversation about what helped you become effective in product?",perspective,approach],
 )),
 ...variants("project-operations","Project, program, and operations",set(
  ["Quick question about technical delivery","Question about program work at {{company}}","Building stronger operations experience"],
  ["compact-systems-context","compact-business-context","compact-technical-context"],
  ["I’m interested in how strong operators keep technical work moving without losing sight of the people and process around it.","I’m trying to understand which early experiences build credibility in program and operations roles.","The intersection of systems, coordination, and dependable execution is where I’d like to keep growing."],
  [quick,perspective,approach],
 )),
 ...variants("consulting","Consulting",set(
  ["Quick question about consulting","Question about consulting at {{company}}","From technical work into consulting"],
  ["compact-business-context","compact-systems-context","compact-business-context"],
  ["I’m trying to understand how early-career consultants turn analytical work into recommendations people can actually use.","The mix of structured problem solving, implementation, and client communication is what interests me most.","I’d value a candid view of which technical experiences translate well into consulting."],
  [quick,perspective,approach],
 )),
 ...variants("finance","Finance",set(
  ["Quick question about financial data work","Question about analytics at {{company}}","Data and technology in finance"],
  ["compact-data-context","compact-business-context","compact-systems-context"],
  ["I’m trying to understand where technical data skills are most useful inside financial teams.","The connection between analysis, risk, and real operating decisions is the part I’d like to learn more about.","I’d value a practical view of how someone with a technical background can become useful in this space."],
  [quick,perspective,approach],
 )),
 ...variants("commodities-energy","Commodities and energy",set(
  ["Quick question about energy analytics","Question about data at {{company}}","Data work in commodities and energy"],
  ["compact-data-context","compact-business-context","compact-systems-context"],
  ["I’m curious how data work supports market and operating decisions when conditions change quickly.","The mix of analytics, market context, and physical operations is what makes this field interesting to me.","I’d value a practical view of which technical skills matter most in this work."],
  [quick,perspective,approach],
 )),
 ...variants("defense-technology","Defense and technology",set(
  ["Quick question about technical defense work","Question about engineering at {{company}}","Building useful experience in defense technology"],
  ["compact-technical-context","compact-systems-context","compact-business-context"],
  ["I’m trying to understand which early technical experiences are most useful on complex, mission-focused teams.","The combination of dependable systems, engineering judgment, and clear delivery is what interests me.","I’d value a grounded view of how someone early in their career can contribute well in this environment."],
  [quick,perspective,approach],
 )),
 ...variants("career-path-leader","Career path",set(
  ["Quick career question","Question about growing into broader ownership","Building a strong technical foundation"],
  ["compact-technical-context","compact-systems-context","compact-business-context"],
  ["I’m focused on becoming a strong contributor first and would value your view on which foundations matter most.","I’m curious how experienced practitioners earn broader ownership without getting too far from the work.","I’m trying to make thoughtful early choices that leave room for more responsibility later."],
  [quick,perspective,approach],
 )),
];
