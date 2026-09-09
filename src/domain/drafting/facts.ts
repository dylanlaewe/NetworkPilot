import type{FactFragment,SenderFact}from"./types";
export const DYLAN_FACTS:SenderFact[]=[
 {id:"sender-name",value:"Dylan Laewe",category:"identity",approved:true,enabled:true},
 {id:"degree",value:"B.S. in Computer Science",category:"education",approved:true,enabled:true},
 {id:"graduation",value:"May 2026",category:"education",approved:true,enabled:true},
 {id:"internship",value:"Business Intelligence / Data Engineering internship experience at Bresco Broadband",category:"experience",approved:true,enabled:true},
 {id:"technical-work",value:"ETL, automation, data integration, SQL, Power BI, Python, APIs, and reporting",category:"skills",approved:true,enabled:true},
 {id:"systems-scale",value:"Experience integrating workflows across more than 20 business and operational systems",category:"scale",approved:true,enabled:true},
 {id:"career-interests",value:"Interest in data, analytics, engineering, AI and automation, and product and business problems",category:"interest",approved:true,enabled:true},
 {id:"northeast",value:"Northeast preference with Boston, New York City, and New Jersey relevance",category:"geography",approved:true,enabled:true},
 {id:"remote",value:"Interest in remote-friendly opportunities",category:"geography",approved:true,enabled:true},
 {id:"long-term-direction",value:"Long-term interest in leadership, ownership, and responsibility across technical and delivery work",category:"direction",approved:true,enabled:true},
];
export function resolveApprovedFacts(ids:string[],registry:SenderFact[]=DYLAN_FACTS):Map<string,SenderFact>{const facts=new Map<string,SenderFact>();for(const id of ids){if(facts.has(id))throw new Error(`Duplicate sender fact ID: ${id}`);const fact=registry.find((item)=>item.id===id);if(!fact||!fact.approved||!fact.enabled)throw new Error(`Unknown, disabled, or unapproved sender fact: ${id}`);facts.set(id,fact);}return facts;}
const value=(facts:ReadonlyMap<string,SenderFact>,id:string)=>facts.get(id)?.value??(()=>{throw new Error(`Fragment missing fact: ${id}`)})();
const lowerFirst=(text:string)=>text.charAt(0).toLowerCase()+text.slice(1);
export const FACT_FRAGMENTS:FactFragment[]=[
 {id:"identity-graduated",factIds:["sender-name","graduation","degree"],claimMarkers:["Dylan Laewe","graduated in May 2026","B.S. in Computer Science"],render:(f)=>`My name is ${value(f,"sender-name")}, and I graduated in ${value(f,"graduation")} with a ${value(f,"degree")}.`},
 {id:"identity-recent-grad",factIds:["sender-name","degree","graduation"],claimMarkers:["Dylan Laewe","recent computer science graduate","May 2026"],render:(f)=>`I’m ${value(f,"sender-name")}, a recent computer science graduate who earned a ${value(f,"degree")} in ${value(f,"graduation")}.`},
 {id:"identity-since-may",factIds:["sender-name","graduation","degree"],claimMarkers:["Dylan Laewe","since graduating in May 2026","B.S. in Computer Science"],render:(f)=>`I’m ${value(f,"sender-name")}—since graduating in ${value(f,"graduation")} with a ${value(f,"degree")}, I’ve been exploring where I can contribute and keep learning.`},
 {id:"internship",factIds:["internship"],claimMarkers:["Bresco Broadband","Business Intelligence / Data Engineering internship"],render:(f)=>`My ${value(f,"internship")} gave me practical experience connecting technical work to operating needs.`},
 {id:"technical-skills",factIds:["technical-work"],claimMarkers:["ETL, automation, data integration, SQL, Power BI, Python, APIs, and reporting"],render:(f)=>`My hands-on work has included ${value(f,"technical-work")}.`},
 {id:"systems",factIds:["systems-scale"],claimMarkers:["more than 20 business and operational systems"],render:(f)=>`I have ${lowerFirst(value(f,"systems-scale"))}.`},
 {id:"interests",factIds:["career-interests"],claimMarkers:["data, analytics, engineering, AI and automation"],render:(f)=>`I have an ${lowerFirst(value(f,"career-interests"))}.`},
 {id:"leadership-direction",factIds:["long-term-direction"],claimMarkers:["leadership, ownership, and responsibility"],render:(f)=>`Looking farther ahead, I’m interested in ${lowerFirst(value(f,"long-term-direction")).replace(/^long-term interest in /,"")}.`},
 {id:"northeast",factIds:["northeast"],claimMarkers:["Boston, New York City, and New Jersey"],render:(f)=>`I have a ${lowerFirst(value(f,"northeast"))}.`},
 {id:"remote",factIds:["remote"],claimMarkers:["remote-friendly opportunities"],render:(f)=>`I also have an ${lowerFirst(value(f,"remote"))}.`},
];
export function fragmentById(id:string):FactFragment{const fragment=FACT_FRAGMENTS.find((item)=>item.id===id);if(!fragment)throw new Error(`Unknown fact fragment: ${id}`);return fragment;}
