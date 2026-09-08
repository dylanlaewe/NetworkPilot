import type { SenderFact } from "./types";

export const DYLAN_FACTS: SenderFact[] = [
  { id:"sender-name",value:"Dylan Laewe",category:"identity",approved:true },
  { id:"degree",value:"B.S. Computer Science",category:"education",approved:true },
  { id:"graduation",value:"May 2026 graduation",category:"education",approved:true },
  { id:"internship",value:"Business Intelligence / Data Engineering internship experience at Bresco Broadband",category:"experience",approved:true },
  { id:"technical-work",value:"work spanning ETL, automation, data integration, SQL, Power BI, Python, APIs, and reporting",category:"skills",approved:true },
  { id:"systems-scale",value:"experience integrating workflows across more than 20 business and operational systems",category:"scale",approved:true },
  { id:"career-interests",value:"interest in data, analytics, engineering, AI and automation, and product and business problems",category:"interest",approved:true },
  { id:"northeast",value:"a Northeast preference with Boston, New York City, and New Jersey relevance",category:"geography",approved:true },
  { id:"remote",value:"interest in remote-friendly opportunities",category:"geography",approved:true },
  { id:"long-term-direction",value:"a long-term interest in leadership, ownership, and responsibility across technical and delivery work",category:"direction",approved:true },
];
export function factById(id:string): SenderFact { const fact=DYLAN_FACTS.find((item)=>item.id===id); if(!fact) throw new Error(`Unknown or unapproved sender fact: ${id}`); return fact; }
