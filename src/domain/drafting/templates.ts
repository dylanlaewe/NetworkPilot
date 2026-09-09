import{fragmentById}from"./facts";import type{DraftTemplate,OutreachLane}from"./types";
export const TEMPLATE_CATALOG_VERSION="catalog-v3";
type VariantSeed=Pick<DraftTemplate,"variantId"|"structure"|"subject"|"reason"|"question"|"fragmentIds">;
const variants=(laneId:OutreachLane,displayName:string,seeds:VariantSeed[]):DraftTemplate[]=>seeds.map((seed)=>{const factIds=[...new Set(seed.fragmentIds.flatMap((id)=>fragmentById(id).factIds))];return{...seed,id:`${laneId}-${seed.variantId}`,laneId,displayName:`${displayName} — ${seed.variantId}`,catalogVersion:TEMPLATE_CATALOG_VERSION,version:"3.0.0",factIds};});
const shared=(subject:string,reason:string):VariantSeed[]=>[
 {variantId:"direct-practical",structure:"facts-first",fragmentIds:["identity-graduated","internship","technical-skills"],subject,reason,question:"Would you be open to a brief 15-minute conversation about what a new contributor should learn first?"},
 {variantId:"career-curiosity",structure:"reason-first",fragmentIds:["identity-recent-grad","interests"],subject:`Career path question: ${subject}`,reason:`${reason} I’m trying to understand the early decisions that create a strong foundation.`,question:"If you have about 15 minutes, could I ask how you would approach that first stage today?"},
 {variantId:"common-ground",structure:"experience-first",fragmentIds:["identity-since-may","systems","technical-skills"],subject:`Practical perspective on ${subject}`,reason:`${reason} My interest comes from seeing how interconnected technical and operational work can be.`,question:"Could I ask for 15 minutes to hear which practical experiences have proved most useful in your work?"},
];
export const DRAFT_TEMPLATES:DraftTemplate[]=[
 ...variants("data-analytics","Data and analytics",shared("data and analytics work","Your work is relevant to the kind of grounded data practice I want to build toward.")),
 ...variants("engineering-technical","Engineering and technical",shared("engineering paths","I’m exploring engineering work where software, automation, and real operating problems meet.")),
 ...variants("project-operations","Project, program, and operations",shared("technical delivery","I’m interested in roles that combine technical understanding with dependable project, program, or operations delivery.")),
 ...variants("consulting","Consulting",shared("analytical consulting","I’m exploring how consultants combine analytical depth, implementation, and clear client communication.")),
 ...variants("finance","Finance",shared("data in financial services","I’m interested in how financial teams use data and technology to support decisions, risk, and operations.")),
 ...variants("commodities-energy","Commodities and energy",shared("commodities and energy analytics","I’m curious about work where data, market context, and operational decisions come together.")),
 ...variants("defense-technology","Defense and technology",shared("technical work in defense and autonomy","I’m drawn to technical work connected to consequential products, complex systems, and clear missions.")),
 ...variants("career-path-leader","Manager and director career path",[
  {variantId:"direct-practical",structure:"reason-first",fragmentIds:["identity-graduated","internship","leadership-direction"],subject:"Foundations for responsible technical leadership",reason:"I’m focused on becoming a strong individual contributor before taking on broader responsibility, and your career perspective could help me prioritize the right foundations.",question:"Would you be open to a 15-minute conversation about the experiences that mattered before you moved into leadership?"},
  {variantId:"career-curiosity",structure:"facts-first",fragmentIds:["identity-recent-grad","interests","leadership-direction"],subject:"A career-path question",reason:"I’m interested in how technical practitioners gradually earn wider ownership without losing touch with the work itself.",question:"If you have roughly 15 minutes, I’d value your view on what an early-career contributor should focus on first."},
  {variantId:"common-ground",structure:"experience-first",fragmentIds:["identity-since-may","systems","leadership-direction"],subject:"From technical delivery to broader ownership",reason:"Working across connected systems made me curious about how experienced leaders balance technical judgment, people, and delivery.",question:"Could I ask you for 15 minutes about the steps that prepared you for broader ownership?"},
 ]),
];
