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
 {id:"identity-graduated",factIds:["sender-name","graduation","degree"],claimMarkers:["Dylan Laewe","graduated in May 2026","B.S. in Computer Science"],render:(f)=>`I’m ${value(f,"sender-name")}. I graduated in ${value(f,"graduation")} with a ${value(f,"degree")}.`},
 {id:"identity-recent-grad",factIds:["sender-name","degree","graduation"],claimMarkers:["Dylan Laewe","recent computer science graduate","May 2026"],render:(f)=>`I’m ${value(f,"sender-name")}, a recent computer science graduate as of ${value(f,"graduation")}.`},
 {id:"identity-since-may",factIds:["sender-name","graduation","degree"],claimMarkers:["Dylan Laewe","After graduating in May 2026","B.S. in Computer Science"],render:(f)=>`I’m ${value(f,"sender-name")}. After graduating in ${value(f,"graduation")} with a ${value(f,"degree")}, I’ve been looking for a place where I can contribute and keep learning.`},
 {id:"internship",factIds:["internship"],claimMarkers:["Bresco Broadband","BI and data engineering internship"],render:()=>`I got practical experience during a BI and data engineering internship at Bresco Broadband, where the technical work was tied closely to day-to-day operating needs.`},
 {id:"technical-skills",factIds:["technical-work"],claimMarkers:["SQL, Python, ETL, APIs, and automation"],render:()=>`Most of my hands-on work has involved SQL, Python, ETL, APIs, and automation.`},
 {id:"systems",factIds:["systems-scale"],claimMarkers:["more than 20 business and operational systems"],render:()=>`I’ve also integrated workflows across more than 20 business and operational systems.`},
 {id:"interests",factIds:["career-interests"],claimMarkers:["data, analytics, engineering, AI, and automation"],render:()=>`I’m especially interested in data, analytics, engineering, AI, and automation.`},
 {id:"leadership-direction",factIds:["long-term-direction"],claimMarkers:["leadership, ownership, and responsibility"],render:(f)=>`Looking farther ahead, I’m interested in ${lowerFirst(value(f,"long-term-direction")).replace(/^long-term interest in /,"")}.`},
 {id:"northeast",factIds:["northeast"],claimMarkers:["Boston, New York City, and New Jersey"],render:(f)=>`I have a ${lowerFirst(value(f,"northeast"))}.`},
 {id:"remote",factIds:["remote"],claimMarkers:["remote-friendly opportunities"],render:(f)=>`I also have an ${lowerFirst(value(f,"remote"))}.`},
 {id:"compact-data-context",factIds:["graduation","degree","internship","technical-work"],claimMarkers:["graduated in May 2026","B.S. in Computer Science","BI and data engineering","SQL, Python, ETL, and APIs"],render:()=>"I graduated in May 2026 with a B.S. in Computer Science and got hands-on BI and data engineering experience using SQL, Python, ETL, and APIs."},
 {id:"compact-technical-context",factIds:["graduation","degree","internship","technical-work"],claimMarkers:["graduated in May 2026","B.S. in Computer Science","BI and data engineering","automation and integrations"],render:()=>"I graduated in May 2026 with a B.S. in Computer Science and got hands-on BI and data engineering experience with automation and integrations."},
 {id:"compact-product-context",factIds:["internship","technical-work","systems-scale","career-interests"],claimMarkers:["technical side in BI and data engineering","automation, integrations","business and technical needs","interested in product"],render:()=>"My background is on the technical side in BI and data engineering, with experience in automation, integrations, and systems that connect business and technical needs. That work has made me increasingly interested in product."},
 {id:"compact-business-context",factIds:["graduation","degree","internship"],claimMarkers:["graduated in May 2026","computer science degree","BI and data engineering","technical work to business needs"],render:()=>"I graduated in May 2026 with a computer science degree and practical BI and data engineering experience that tied technical work to business needs."},
 {id:"compact-systems-context",factIds:["internship","technical-work","systems-scale"],claimMarkers:["BI and data engineering","automation and APIs","more than 20 business and operational systems"],render:()=>"My BI and data engineering work has included automation and APIs, along with integrations across more than 20 business and operational systems."},
];
export function fragmentById(id:string):FactFragment{const fragment=FACT_FRAGMENTS.find((item)=>item.id===id);if(!fragment)throw new Error(`Unknown fact fragment: ${id}`);return fragment;}
