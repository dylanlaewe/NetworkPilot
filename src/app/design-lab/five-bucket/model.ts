import { CANONICAL, personalize, TEMPLATE_VERSION } from "./templates";

export const BUCKETS = [
  { id: "recruiters", label: "Recruiters", singular: "recruiter", find: "recruiters", intent: "Connect about a focused cluster of data and analytics opportunities." },
  { id: "peers", label: "Peers & practitioners", singular: "peer", find: "peers", intent: "Learn from someone entering the field or building relevant experience." },
  { id: "managers", label: "Managers & team leaders", singular: "manager", find: "managers", intent: "Learn about their career and how they approach their work." },
  { id: "executives", label: "Executives", singular: "executive", find: "executives", intent: "Explore the path toward verified functional leadership." },
  { id: "ceos", label: "CEOs & presidents", singular: "CEO/president", find: "CEOs/presidents", intent: "Seek guidance on building useful products and leading a team." },
] as const;
export type Bucket = typeof BUCKETS[number]["id"];
export type Section = "Drafts" | "Sent" | "Candidates";
export type Stage = "reserve" | "editing" | "approved" | "created" | "uncertain" | "sent" | "skipped" | "excluded";
export type Resume = { id: string; label: string; version: string; active: boolean; size: string };
export type Snapshot = { subject: string; body: string; attachment: Resume | null; bucket: Bucket; templateVersion: string };
export type History = Snapshot & { outcome: "sent" | "bounced"; at: string };
export type Person = {
  id: string; name: string; company: string; context: string; title: string; function: string; field: string;
  evidence: string; earlyCareer: boolean; bucket: Bucket; reviewNeeded: boolean; block?: string;
  email: string; stage: Stage; subject: string; body: string; canonicalSubject: string; canonicalBody: string;
  attachment: string | null; resumeDecisionNeeded: boolean; userEdited: boolean; approved?: Snapshot; history: History[];
  corrections: string[];
};
export type State = { people: Person[]; queue: string[]; resumes: Resume[]; defaultResume: string; budgetUsed: number; searchRuns: number; notice: string };
export const ACTIVE: Stage[] = ["editing", "approved", "created", "uncertain"];
export const BUDGET = 10;
export const ACTIVE_LIMIT = 30;
export const INITIAL_RESUMES: Resume[] = [
  { id: "general-v2", label: "General Resume", version: "v2 · synthetic", active: true, size: "84 KB · metadata only" },
  { id: "general-v1", label: "General Resume (historical)", version: "v1 · synthetic", active: false, size: "78 KB · metadata only" },
  { id: "product-v1", label: "Product Resume", version: "v1 · synthetic", active: true, size: "81 KB · metadata only" },
];

function fixture(bucket: Bucket, index: number, overrides: Partial<Person> = {}): Person {
  const names = ["Avery Linden", "Morgan Ellis", "Jordan Vale", "Camille Rowan", "Riley Moss", "Taylor Finch", "Sasha Reed", "Quinn Hart", "Emerson Wren", "Alex Bell", "Sam Lake", "Jamie North", "Robin Brook", "Casey Fern"];
  const title = { recruiters: "Executive Recruiter", peers: index % 2 ? "Senior Data Practitioner" : "Associate Product Analyst", managers: "Manager, Business Intelligence", executives: "VP, Data Platforms", ceos: index % 2 ? "President, Energy Division" : "Founder & CEO" }[bucket];
  const person: Person = {
    id: `${bucket}-${index}`, name: names[index % names.length], company: `Fictional ${["Juniper", "Elmbridge", "Northlight", "Fieldnote"][index % 4]} ${bucket === "ceos" ? "Ventures" : "Works"} ${bucket.slice(0, 2).toUpperCase()}${index + 1}`,
    context: ["Regional private company", "Large employer", "Early-stage startup", "Independent consulting practice"][index % 4],
    title, function: bucket === "executives" ? "data platforms" : bucket === "recruiters" ? "talent acquisition" : "analytics",
    field: bucket === "peers" ? ["Product Management", "data and analytics", "software", "AI", "project and program work", "finance", "commodities", "energy", "consulting"][index % 9] : "data and analytics",
    evidence: bucket === "executives" ? "Fictional leadership bio explicitly confirms responsibility for the data platforms function and its teams." : bucket === "recruiters" ? "Fictional role profile confirms recruiting is this contact's relevant function, regardless of seniority." : bucket === "managers" ? "Fictional team profile confirms BI management. Hiring responsibility is not verified." : bucket === "ceos" ? (index % 2 ? "Fictional company profile: president of the Energy Division, not the company president." : "Fictional founder profile: company-wide CEO; launched a regional data cooperative.") : (index % 2 ? "Fictional bio: nine years as an individual contributor; a transition from operations into analytics." : "Fictional bio: graduated in 2025; one year of analyst experience. First-job timing is not inferred."),
    earlyCareer: bucket === "peers" && index % 2 === 0, bucket, reviewNeeded: false,
    email: `${bucket}.${index}@example.invalid`, stage: "reserve", subject: "", body: "", canonicalSubject: "", canonicalBody: "",
    attachment: null, resumeDecisionNeeded: false, userEdited: false, history: [], corrections: [], ...overrides,
  };
  if (bucket === "peers" && !person.earlyCareer) person.evidence = `Fictional bio: nine years as an individual contributor; a transition from operations into ${person.field}.`;
  const slots = { "First name": person.name.split(" ")[0], Company: person.company, field: person.field, role: person.title,
    "specific topic": "connecting business systems", "verified function": person.function,
    "specific reason for contacting this person": index % 2 ? "your division's fictional community energy data project" : "your fictional regional data cooperative" };
  person.subject = person.canonicalSubject = personalize(CANONICAL[bucket].subject, slots);
  person.body = person.canonicalBody = personalize(CANONICAL[bucket].body, slots);
  if (bucket === "peers" && !person.earlyCareer) person.body = person.canonicalBody = person.body.replace(`I'd be curious how you approached your job search and what helped you get started in ${person.field}.`, `I'd be curious what you learned while moving from operations into ${person.field}.`);
  return person;
}

export function snapshot(p: Person, resumes: Resume[]): Snapshot {
  const attachment = resumes.find(r => r.id === p.attachment);
  return { subject: p.subject, body: p.body, attachment: attachment ? { ...attachment } : null, bucket: p.bucket, templateVersion: TEMPLATE_VERSION };
}

export function initialState(): State {
  const ambiguous = fixture("executives", 2, {
    name: "Alexandra-Rose Montgomery-Wells",
    title: "VP, Client Analytics & Strategic Operations",
    function: "client analytics",
    reviewNeeded: true,
    evidence: "A VP title is listed, but leadership scope is absent. Fictional follow-up evidence confirms an experienced individual contributor. Historical copy uses a truthful alternative about client analytics work without claiming leadership. Review a correction to Peers & practitioners.",
    block: "Prior contact: cooldown remains active",
  });
  // This historical fixture deliberately used a truthful alternative before its bucket was reviewed.
  ambiguous.body = ambiguous.canonicalBody = ambiguous.body.replace(
    `Your role leading client analytics at ${ambiguous.company} is the kind of responsibility I'd like to grow toward.`,
    `I saw your work in client analytics at ${ambiguous.company} and wanted to learn about your career.`,
  );
  ambiguous.history = [{ ...snapshot(ambiguous, INITIAL_RESUMES), templateVersion: `${TEMPLATE_VERSION}.truthful-alternative`, outcome: "sent", at: "2026-09-10 · fictional" }];
  const people = BUCKETS.flatMap(b => Array.from({ length: b.id === "peers" ? 26 : b.id === "recruiters" ? 14 : 6 }, (_, i) => b.id === "executives" && i === 2 ? ambiguous : fixture(b.id, i)));
  for (const p of people) if (Number(p.id.split("-")[1]) < 2) { p.stage = "editing"; if (p.bucket === "recruiters") p.attachment = "general-v2"; }
  const restrictions = ["Prior contact: cooldown remains active", "Opted out: excluded from new outreach", "Hard bounce: address suppressed", "Company contact policy: another relationship is active", "Evidence needs review before drafting"];
  for (let i = 9; i < 14; i++) people.find(p => p.id === `recruiters-${i}`)!.block = restrictions[i - 9];
  const sent = fixture("ceos", 20, { stage: "sent", name: "Harper Stone" });
  sent.history = [{ ...snapshot(sent, INITIAL_RESUMES), outcome: "sent", at: "2026-09-12 · fictional" }];
  const bounced = people.find(p => p.id === "recruiters-11")!;
  bounced.history = [{ ...snapshot(bounced, INITIAL_RESUMES), outcome: "bounced", at: "2026-09-08 · fictional" }];
  const uncertain = fixture("peers", 30, { stage: "uncertain", name: "Drew Ash", block: "Uncertain send: verification required before any retry" });
  uncertain.approved = snapshot(uncertain, INITIAL_RESUMES);
  people.push(sent, uncertain);
  return { people, queue: people.filter(p => ACTIVE.includes(p.stage)).map(p => p.id), resumes: INITIAL_RESUMES.map(r => ({ ...r })), defaultResume: "general-v2", budgetUsed: 0, searchRuns: 0, notice: "Fictional workspace ready. Changes live in this tab and reset on reload." };
}

export function unavailableReason(s: State, p: Person): string | null {
  if (p.block) return p.block;
  if (p.reviewNeeded) return "Classification needs review";
  if (p.stage !== "reserve") return p.stage === "skipped" ? "Skipped for this session" : p.stage === "excluded" ? "Excluded across all buckets" : "Already in active work or contacted";
  if (p.history.length) return "Previously contacted";
  if (s.people.some(other => other.id !== p.id && other.company === p.company && (ACTIVE.includes(other.stage) || other.history.length))) return "Company contact policy: another relationship is active";
  return null;
}
export function capacity(s: State, bucket: Bucket, earlyCareerOnly = false) { return s.people.filter(p => p.bucket === bucket && !(bucket === "peers" && earlyCareerOnly && !p.earlyCareer) && !unavailableReason(s, p)); }
export function rows(s: State, section: Section, bucket: Bucket | "all") {
  const base = section === "Drafts" ? s.queue.map(id => s.people.find(p => p.id === id)!).filter(p => ACTIVE.includes(p.stage)) : section === "Sent" ? s.people.filter(p => p.history.length) : s.people.filter(p => !ACTIVE.includes(p.stage) && p.stage !== "sent");
  return base.filter(p => bucket === "all" || (section === "Sent" ? p.history.some(h => h.bucket === bucket) : p.bucket === bucket));
}
function newDraft(p: Person, s: State): Person {
  const configured = s.resumes.find(r => r.id === s.defaultResume && r.active);
  return { ...p, stage: "editing", attachment: p.bucket === "recruiters" ? configured?.id ?? null : null, resumeDecisionNeeded: p.bucket === "recruiters" && !configured };
}
export function addDrafts(s: State, bucket: Bucket, count: number, earlyCareerOnly = false): State {
  if (!Number.isInteger(count) || count < 1 || count > 20) return { ...s, notice: "Choose a whole number from 1 to 20." };
  const available = capacity(s, bucket, earlyCareerOnly);
  const chosen: Person[] = [];
  const companies = new Set<string>();
  for (const p of available) if (!companies.has(p.company) && chosen.length < Math.min(count, ACTIVE_LIMIT - s.queue.length)) { chosen.push(p); companies.add(p.company); }
  const ids = new Set(chosen.map(p => p.id));
  return { ...s, people: s.people.map(p => ids.has(p.id) ? newDraft(p, s) : p), queue: [...s.queue, ...chosen.map(p => p.id)], notice: `Added ${chosen.length} of ${count} additional ${bucket === "peers" && earlyCareerOnly ? "early-career peer" : BUCKETS.find(b => b.id === bucket)!.singular} drafts. Existing edits and order retained.${chosen.length < count ? " Shortfall: qualified reserve in the selected scope or shared active-draft capacity is exhausted. Review Candidates or simulate Find more." : ""}` };
}
export function queueAction(s: State, id: string, action: "skip" | "replace" | "exclude", earlyCareerOnly = false): State {
  const p = s.people.find(p => p.id === id);
  if (!p || p.stage !== "editing") return { ...s, notice: "Only unapproved drafts can leave the queue this way." };
  const replacement = action === "replace" ? capacity(s, p.bucket, earlyCareerOnly)[0] : undefined;
  if (action === "replace" && !replacement) return { ...s, notice: `No eligible replacement in ${BUCKETS.find(b => b.id === p.bucket)!.label}${p.bucket === "peers" && earlyCareerOnly ? " with the Early-career only filter" : ""}. This draft stays in place. Find more in Candidates.` };
  return { ...s, people: s.people.map(item => item.id === id ? { ...item, stage: action === "exclude" ? "excluded" : "skipped" } : item.id === replacement?.id ? newDraft(item, s) : item), queue: s.queue.flatMap(queued => queued === id ? replacement ? [replacement.id] : [] : [queued]), notice: action === "replace" ? "Replaced from the same bucket at the same queue position. Previous person skipped for this session." : action === "exclude" ? "Person excluded across every bucket. No contact or cooldown was recorded." : "Skipped for this session. No contact or cooldown was recorded; this person will not immediately resurface." };
}
export function findMore(s: State, bucket: Bucket, earlyCareerOnly = false): State {
  const charge = Math.min(5, BUDGET - s.budgetUsed);
  if (!charge) return { ...s, notice: "Shared simulated search budget exhausted: 10 of 10 used. Use the existing reserve; switching buckets does not reset the allowance." };
  const count = bucket === "recruiters" ? (s.searchRuns === 0 ? 2 : 1) : Math.min(3, charge);
  const added = Array.from({ length: Math.min(count, charge) }, (_, i) => fixture(bucket, 100 + s.searchRuns * 10 + (bucket === "peers" && earlyCareerOnly ? i * 2 : i)));
  return { ...s, people: [...s.people, ...added], budgetUsed: s.budgetUsed + charge, searchRuns: s.searchRuns + 1, notice: `Simulated search complete: ${added.length} of ${charge} requested ${bucket === "peers" && earlyCareerOnly ? "early-career peers" : BUCKETS.find(b => b.id === bucket)!.find} added to reserve. ${charge - added.length} unavailable because the fictional search pool has no more verified matches. Shared allowance: ${s.budgetUsed + charge}/${BUDGET} used.${s.budgetUsed + charge === BUDGET ? " Budget exhausted across every bucket." : ""}` };
}
export function validation(p: Person, resumes: Resume[]): string[] {
  const errors: string[] = [];
  const copy = `${p.subject}\n${p.body}`;
  if (!/^[^\s<>@]+@[^\s<>@]+\.invalid$/.test(p.email) || /[\r\n]/.test(p.subject) || !p.subject.trim()) errors.push("Use a safe fictional .invalid recipient and a single-line subject.");
  if (/\[[^\]]*\]/.test(copy)) errors.push("Resolve the personalization placeholders from evidence.");
  if (/—/.test(copy)) errors.push("Remove em dashes before approval.");
  if (/current student|I'm a student|prior PM|previously (?:a |worked as a )?product manager|found you on LinkedIn/i.test(copy)) errors.push("Remove unsupported student, prior-PM, or LinkedIn claims.");
  if (!p.attachment && /attached my resume|resume is attached/i.test(p.body)) errors.push("The message claims a resume is attached. Attach one or review the proposed copy adjustment.");
  if (p.attachment && !resumes.some(r => r.id === p.attachment && r.active)) errors.push("The selected resume is inactive. Choose an active resume or explicitly continue without one.");
  if (p.resumeDecisionNeeded) errors.push("The configured default is unavailable. Choose an active resume or explicitly continue without one.");
  if (p.reviewNeeded) errors.push("Review the classification and supporting evidence first.");
  if (!/would (?:you|love)|would it be possible|open to|could we|can we|let's connect/i.test(p.body)) errors.push("Keep one clear invitation to connect; a question mark is not required.");
  if (p.block) errors.push(p.block);
  return errors;
}
export function approve(s: State, id: string): State {
  const p = s.people.find(p => p.id === id);
  if (!p || p.stage !== "editing") return s;
  const issues = validation(p, s.resumes);
  if (issues.length) return { ...s, notice: `Approval blocked. ${issues.join(" ")}` };
  return { ...s, people: s.people.map(p => p.id === id ? { ...p, stage: "approved", approved: snapshot(p, s.resumes) } : p), notice: "Simulated approval recorded. Message and resume version are frozen. Next: create simulated draft." };
}
export function lifecycle(s: State, id: string, action: "create" | "send" | "verify"): State {
  const p = s.people.find(p => p.id === id);
  if (!p?.approved || (action === "create" && p.stage !== "approved") || (action === "send" && p.stage !== "created") || (action === "verify" && p.stage !== "uncertain")) return s;
  const sent = action !== "create";
  return { ...s, people: s.people.map(p => p.id === id ? { ...p, stage: sent ? "sent" : "created", history: sent ? [...p.history, { ...p.approved!, outcome: "sent", at: "2026-09-22 · simulated" }] : p.history } : p), queue: sent ? s.queue.filter(q => q !== id) : s.queue, notice: sent ? "Simulated sent record confirmed. Removed from Drafts and recorded once in Sent. No message left this browser." : "Simulated draft created locally. Review the final confirmation before simulated sending." };
}
export function correctBucket(s: State, id: string, bucket: Bucket): State {
  const p = s.people.find(p => p.id === id);
  if (!p || !p.reviewNeeded) return s;
  return { ...s, people: s.people.map(p => p.id === id ? { ...p, bucket, reviewNeeded: false, corrections: [...p.corrections, `Reviewed: ${p.bucket} → ${bucket}. Fictional scope evidence reviewed; history and restrictions retained.`] } : p), notice: "Bucket correction recorded for the existing person. Prior sent bucket, message, and cooldown remain unchanged." };
}
