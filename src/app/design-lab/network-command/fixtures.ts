export type DraftState = "needs-review" | "approved" | "gmail-created" | "uncertain";
export type Track = "Professional" | "Recruiter";

export type DraftFixture = {
  id: string;
  person: string;
  company: string;
  role: string;
  lane: string;
  location: string;
  track: Track;
  state: DraftState;
  subject: string;
  body: string;
  intent: string;
  relevance: string[];
  evidence: string[];
  resume: string;
  version: number;
};

const baseDrafts: Omit<DraftFixture, "id" | "state" | "version">[] = [
  {
    person: "Mara Ellison",
    company: "Northstar Analytics",
    role: "Senior Data Platform Engineer",
    lane: "Data",
    location: "New York, NY",
    track: "Professional",
    subject: "Your path from analytics into data platforms",
    body: "Hi Mara,\n\nI’m a senior at Marist University exploring early-career roles where data, software, and product decisions meet. Your progression from analytics into data platform engineering at Northstar stood out to me, especially the way your team supports decisions across the business.\n\nI’d appreciate hearing what helped you build credibility when you moved closer to platform work, and what you would prioritize if you were making that transition today. Would you be open to a brief conversation in the next couple of weeks?\n\nBest,\nDylan",
    intent: "Learn how an analytics foundation can translate into platform ownership.",
    relevance: ["Data-platform transition", "Early-career perspective", "Decision infrastructure"],
    evidence: ["Current employer and role are provider-backed", "Professional email evidence is verified", "No prior outreach or active cooldown"],
    resume: "None",
  },
  {
    person: "Theo Mercer",
    company: "Meridian Systems",
    role: "Group Product Manager, Applied Intelligence Platforms",
    lane: "Product",
    location: "Boston, MA",
    track: "Professional",
    subject: "Building product judgment around applied intelligence",
    body: "Hi Theo,\n\nI’m finishing my degree at Marist University and working toward product roles that sit close to technical teams. Meridian’s applied intelligence work caught my attention because it seems to demand both product judgment and enough technical fluency to ask better questions.\n\nI’d value your perspective on how early-career candidates can demonstrate that combination before they have a formal product title. Would you be open to a short conversation?\n\nBest,\nDylan",
    intent: "Understand how to demonstrate technical product judgment without overstating experience.",
    relevance: ["Product transition", "Applied intelligence", "Technical fluency"],
    evidence: ["Long employer identity resolved", "Role-family mapping: Product", "Candidate currently eligible"],
    resume: "Product Resume · v4",
  },
  {
    person: "Inez Park",
    company: "Helix Labs",
    role: "Principal Machine Learning Engineer, Model Evaluation and Reliability",
    lane: "AI / ML",
    location: "San Francisco, CA",
    track: "Professional",
    subject: "Model evaluation as an engineering discipline",
    body: "Hi Inez,\n\nI’m a Marist University senior interested in how teams turn AI prototypes into dependable products. Your work in model evaluation and reliability at Helix Labs stood out because it treats evaluation as an engineering discipline rather than a final checkpoint.\n\nI’d be grateful to hear which skills have mattered most in making that work useful to product and engineering partners. Would you be open to a brief conversation?\n\nBest,\nDylan",
    intent: "Learn how model evaluation work becomes credible across product and engineering.",
    relevance: ["AI reliability", "Engineering practice", "Cross-functional influence"],
    evidence: ["Role evidence is explicit", "Company identity is complete", "Verified professional contact channel"],
    resume: "Data & AI Resume · v6",
  },
  {
    person: "Caleb Rowan",
    company: "SignalWorks",
    role: "Technical Recruiter, Software and Data Infrastructure",
    lane: "Technical recruiting",
    location: "New York, NY",
    track: "Recruiter",
    subject: "What stands out in early-career technical candidates",
    body: "Hi Caleb,\n\nI’m a senior at Marist University preparing for early-career opportunities across software, data, and technical product work. Your focus on software and data infrastructure recruiting at SignalWorks made me curious about the signals that actually help a candidate stand out beyond a list of tools.\n\nI’d appreciate your perspective on what strong early-career candidates communicate clearly in an initial conversation. Would you be open to a brief chat?\n\nBest,\nDylan",
    intent: "Learn which signals internal technical recruiters trust in early-career candidates.",
    relevance: ["Internal recruiter", "Software and data focus", "Early-career relevance"],
    evidence: ["Provider-native employer identity", "Internal recruiting function", "Staffing-agency ambiguity absent"],
    resume: "General Resume · v3",
  },
  {
    person: "Priya Shah",
    company: "Beacon Software",
    role: "Product Recruiting Lead, Data and Developer Experience",
    lane: "Product recruiting",
    location: "Remote · US",
    track: "Recruiter",
    subject: "Positioning a technical background for product roles",
    body: "Hi Priya,\n\nI’m finishing my degree at Marist University and exploring product roles where a technical and analytical background is useful. Your work recruiting for data and developer-experience product teams at Beacon Software stood out to me.\n\nI’d value your perspective on how candidates can describe a genuine transition toward product without implying experience they have not yet earned. Would you be open to a brief conversation?\n\nBest,\nDylan",
    intent: "Improve truthful positioning for a technical-to-product transition.",
    relevance: ["Internal product recruiting", "Developer experience", "Career transition"],
    evidence: ["Employer domain is valid", "Recruiter function is role-relevant", "Email status meets hard gate"],
    resume: "Product Resume · v4",
  },
  {
    person: "Jonas Bell",
    company: "Lattice Industrial",
    role: "Senior Program Manager, Industrial Data Modernization",
    lane: "Program management",
    location: "Pittsburgh, PA",
    track: "Professional",
    subject: "Coordinating technical modernization across teams",
    body: "Hi Jonas,\n\nI’m a Marist University senior interested in program and product work that helps technical teams execute across organizational boundaries. Your role leading industrial data modernization at Lattice Industrial stood out because the challenge appears as much about alignment as technology.\n\nI’d appreciate hearing how you built the operating credibility to coordinate that kind of work. Would you be open to a short conversation?\n\nBest,\nDylan",
    intent: "Understand how program leaders build trust across technical and operating teams.",
    relevance: ["Program leadership", "Data modernization", "Cross-functional execution"],
    evidence: ["Experience exceeds minimum", "Employer evidence is complete", "No suppression or cooldown"],
    resume: "General Resume · v3",
  },
  {
    person: "Amara Cole",
    company: "Forge Capital",
    role: "Vice President, Data Strategy and Portfolio Operations",
    lane: "Finance",
    location: "New York, NY",
    track: "Professional",
    subject: "How data strategy shapes portfolio operations",
    body: "Hi Amara,\n\nI’m a senior at Marist University exploring roles where analytics supports consequential operating decisions. Your work connecting data strategy with portfolio operations at Forge Capital caught my attention because it appears to bridge analysis and execution.\n\nI’d be grateful to hear how you learned to frame technical analysis for investment and operating partners. Would you be open to a brief conversation?\n\nBest,\nDylan",
    intent: "Learn how analytics is translated for finance and portfolio operating decisions.",
    relevance: ["Finance and analytics", "Portfolio operations", "Executive communication"],
    evidence: ["Finance lane confirmed", "Professional channel verified", "Company cooldown clear"],
    resume: "Data & AI Resume · v6",
  },
  {
    person: "Nolan Reyes",
    company: "Atlas Energy",
    role: "Director, Commodity Analytics and Commercial Optimization",
    lane: "Energy / commodities",
    location: "Houston, TX",
    track: "Professional",
    subject: "Analytics in commodity and commercial decisions",
    body: "Hi Nolan,\n\nI’m finishing my degree at Marist University and exploring how data skills translate into energy and commodities work. Your role connecting commodity analytics with commercial optimization at Atlas Energy stood out because the decisions are both technical and market-driven.\n\nI’d appreciate your perspective on the experiences that best prepare an early-career candidate to contribute in that environment. Would you be open to a short conversation?\n\nBest,\nDylan",
    intent: "Understand how data fluency contributes to commercial energy decisions.",
    relevance: ["Commodities", "Commercial analytics", "Early-career preparation"],
    evidence: ["Energy industry evidence present", "Title normalized successfully", "Contact channel verified"],
    resume: "Data & AI Resume · v6",
  },
  {
    person: "Sofia Bennett",
    company: "Horizon Health Technologies and Clinical Operations Group",
    role: "Staff Software Engineer, Distributed Data Products and Developer Infrastructure",
    lane: "Software",
    location: "Seattle, WA",
    track: "Professional",
    subject: "Building software platforms that other teams trust",
    body: "Hi Sofia,\n\nI’m a Marist University senior interested in software and data systems that improve how other teams work. Your role spanning distributed data products and developer infrastructure at Horizon stood out because it combines technical depth with internal product thinking.\n\nI’d value your perspective on how early-career engineers can show they understand both reliability and the needs of internal users. Would you be open to a brief conversation?\n\nBest,\nDylan",
    intent: "Learn how engineers demonstrate product thinking in infrastructure work.",
    relevance: ["Software infrastructure", "Internal product thinking", "Reliability"],
    evidence: ["Long title retained without truncating meaning", "Company evidence complete", "Candidate is eligible"],
    resume: "Software Resume · v5",
  },
  {
    person: "Darius Kim",
    company: "Quarry Point Consulting",
    role: "Engagement Manager, AI Transformation and Operating Model Design",
    lane: "Consulting",
    location: "Chicago, IL",
    track: "Professional",
    subject: "Making AI transformation operational",
    body: "Hi Darius,\n\nI’m a senior at Marist University exploring consulting and product work at the intersection of technology and operating change. Your focus on AI transformation and operating-model design at Quarry Point caught my attention because implementation seems to matter as much as strategy.\n\nI’d appreciate hearing what helped you learn to make technical recommendations practical for client teams. Would you be open to a brief conversation?\n\nBest,\nDylan",
    intent: "Learn how technology recommendations become workable operating changes.",
    relevance: ["AI transformation", "Consulting", "Operating models"],
    evidence: ["Consulting lane confirmed", "Experience requirement satisfied", "No previous outreach"],
    resume: "General Resume · v3",
  },
  {
    person: "Elena Torres",
    company: "Juniper Market Intelligence",
    role: "Product Operations Manager, Research Platforms",
    lane: "Product operations",
    location: "Washington, DC",
    track: "Professional",
    subject: "Turning research platforms into repeatable product systems",
    body: "Hi Elena,\n\nI’m finishing my degree at Marist University and exploring product operations roles that connect research, data, and execution. Your work on research platforms at Juniper Market Intelligence stood out because it appears to turn complex inputs into a repeatable product system.\n\nI’d value your perspective on what skills matter most when entering product operations early in a career. Would you be open to a brief conversation?\n\nBest,\nDylan",
    intent: "Understand entry points into product operations from an analytical background.",
    relevance: ["Product operations", "Research systems", "Early-career entry"],
    evidence: ["Product Operations mapped to Product lane", "Company legitimate", "Email evidence verified"],
    resume: "Product Resume · v4",
  },
  {
    person: "Owen Price",
    company: "Cedar Robotics",
    role: "Senior Engineering Manager, Autonomous Systems Tooling",
    lane: "Software",
    location: "Austin, TX",
    track: "Professional",
    subject: "Tooling for autonomous-systems engineering teams",
    body: "Hi Owen,\n\nI’m a Marist University senior interested in software systems that make complex engineering teams more effective. Your work on autonomous-systems tooling at Cedar Robotics caught my attention because developer tooling can quietly determine how quickly a team learns.\n\nI’d appreciate hearing what you look for in early-career engineers who want to contribute to internal platforms. Would you be open to a short conversation?\n\nBest,\nDylan",
    intent: "Learn what internal-platform teams value in early-career engineers.",
    relevance: ["Developer tooling", "Autonomous systems", "Engineering leadership"],
    evidence: ["Software role-family match", "Employer ID and domain present", "Eligible for planning"],
    resume: "Software Resume · v5",
  },
  {
    person: "Leila Morgan",
    company: "Mosaic Consumer Products",
    role: "University Recruiting Manager, Product and Analytics",
    lane: "Early career recruiting",
    location: "New York, NY",
    track: "Recruiter",
    subject: "What strong early-career product candidates make clear",
    body: "Hi Leila,\n\nI’m a senior at Marist University preparing for early-career product and analytics opportunities. Your work leading university recruiting for those teams at Mosaic stood out because you see how candidates communicate their potential before they have years of formal experience.\n\nI’d value your perspective on what the strongest candidates make clear in an initial conversation. Would you be open to a brief chat?\n\nBest,\nDylan",
    intent: "Learn how internal university recruiters evaluate product and analytics potential.",
    relevance: ["University recruiting", "Product and analytics", "Internal employer relationship"],
    evidence: ["Internal recruiter classification", "Early-career function supported", "Employer identity credible"],
    resume: "Product Resume · v4",
  },
  {
    person: "Micah Grant",
    company: "Redwood Infrastructure Partners",
    role: "Data and Technology Investment Associate",
    lane: "Finance",
    location: "Boston, MA",
    track: "Professional",
    subject: "Evaluating data and technology businesses",
    body: "Hi Micah,\n\nI’m finishing my degree at Marist University and exploring roles that combine analytical work with technology-focused investing. Your work evaluating data and technology businesses at Redwood Infrastructure Partners stood out to me.\n\nI’d appreciate hearing which experiences helped you develop judgment beyond the financial model itself. Would you be open to a short conversation?\n\nBest,\nDylan",
    intent: "Understand how technology investment judgment develops beyond modeling.",
    relevance: ["Technology investing", "Analytical judgment", "Finance lane"],
    evidence: ["Company identity validated", "Experience within target range", "No prior contact"],
    resume: "General Resume · v3",
  },
  {
    person: "Avery Chen",
    company: "Pinnacle Mobility Networks",
    role: "Technical Product Manager, Network Intelligence and Reliability",
    lane: "Product",
    location: "Denver, CO",
    track: "Professional",
    subject: "Product decisions in network intelligence",
    body: "Hi Avery,\n\nI’m a senior at Marist University moving toward technical product work after building a foundation in data and software. Your role in network intelligence and reliability at Pinnacle Mobility Networks stood out because the product decisions appear inseparable from system behavior.\n\nI’d value your perspective on which technical habits most improved your product judgment. Would you be open to a brief conversation?\n\nBest,\nDylan",
    intent: "Learn which technical habits translate most directly into product judgment.",
    relevance: ["Technical Product", "Network reliability", "Data and software foundation"],
    evidence: ["Product lane match", "Professional contact verified", "Planning gates passed"],
    resume: "Product Resume · v4",
  },
];

const states: DraftState[] = ["needs-review", "needs-review", "needs-review", "approved", "gmail-created", "uncertain"];

export const draftFixtures: DraftFixture[] = Array.from({ length: 30 }, (_, index) => {
  const source = baseDrafts[index % baseDrafts.length];
  const cycle = Math.floor(index / baseDrafts.length);
  return {
    ...source,
    id: `np-prototype-draft-${index + 1}`,
    person: cycle === 0 ? source.person : `${source.person.split(" ")[0]} ${String.fromCharCode(78 + index)}.`,
    state: states[index % states.length],
    version: 3 + (index % 4),
  };
});

const candidateRoles = [
  ["Senior Data Engineer", "Data"],
  ["Associate Product Manager", "Product"],
  ["Machine Learning Platform Engineer", "AI / ML"],
  ["Technical Recruiter, Data and Software", "Technical recruiting"],
  ["Product Recruiter", "Product recruiting"],
  ["Program Manager, Data Transformation", "Program management"],
  ["Investment Associate, Technology", "Finance"],
  ["Commodity Analytics Manager", "Energy / commodities"],
  ["Staff Software Engineer, Developer Platform", "Software"],
] as const;

const companies = [
  "Northstar Analytics",
  "Meridian Systems",
  "Helix Labs",
  "Atlas Energy",
  "Forge Capital",
  "Beacon Software",
  "Lattice Industrial",
  "Horizon Health Technologies and Clinical Operations Group",
  "SignalWorks",
  "Cedar Robotics",
  "Mosaic Consumer Products",
  "Redwood Infrastructure Partners",
];

const firstNames = ["Mara", "Theo", "Inez", "Caleb", "Priya", "Jonas", "Amara", "Nolan", "Sofia", "Darius"];
const lastNames = ["Ellison", "Mercer", "Park", "Rowan", "Shah", "Bell", "Cole", "Reyes", "Bennett", "Kim"];
const locations = ["New York, NY", "Boston, MA", "San Francisco, CA", "Austin, TX", "Chicago, IL", "Remote · US"];

export type CandidateFixture = {
  id: string;
  person: string;
  company: string;
  role: string;
  lane: string;
  track: Track;
  location: string;
  availability: "Available" | "Available later" | "Suppressed";
  relevance: string;
  companyEvidence: string;
  history: string;
};

export const candidateFixtures: CandidateFixture[] = Array.from({ length: 44 }, (_, index) => {
  const [role, lane] = candidateRoles[index % candidateRoles.length];
  const recruiter = lane.includes("recruiting");
  return {
    id: `np-prototype-candidate-${index + 1}`,
    person: `${firstNames[index % firstNames.length]} ${lastNames[(index * 3) % lastNames.length]}`,
    company: companies[(index * 5) % companies.length],
    role,
    lane,
    track: recruiter ? "Recruiter" : "Professional",
    location: locations[(index * 7) % locations.length],
    availability: index === 11 ? "Suppressed" : index % 13 === 0 ? "Available later" : "Available",
    relevance: recruiter
      ? "Internal recruiting evidence aligns with Dylan’s technical and product target lanes."
      : "Role scope connects directly to one of Dylan’s permanent product, data, software, AI, finance, or energy lanes.",
    companyEvidence: "Provider-native employer identity and a valid company domain agree.",
    history: index % 7 === 0 ? "Previously reviewed; no outreach created." : "No prior NetworkPilot activity.",
  };
});

export const stateLabels: Record<DraftState, string> = {
  "needs-review": "Needs review",
  approved: "Approved",
  "gmail-created": "Gmail draft created",
  uncertain: "Send uncertain",
};
