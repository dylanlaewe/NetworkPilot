import Link from "next/link";
import { SPECIFIC_ROLE_TAXONOMY } from "@/domain/candidates";
import { getSimulationRepository } from "@/infrastructure/sqlite/runtime";
import { reviewCandidateAction } from "./actions";

export const dynamic = "force-dynamic";

export default function CandidateReviewPage() {
  const candidates = getSimulationRepository().listImportedCandidates();
  return <main>
    <nav className="nav"><Link className="brand" href="/"><span className="brand-mark"><i/><i/><i/></span>Network<span>Pilot</span></Link><div className="nav-meta"><Link href="/">Campaign</Link><Link href="/draft-studio">Draft Studio</Link><span className="mode-pill"><b/> Simulation only</span></div></nav>
    <section className="hero"><div className="eyebrow"><span>Candidate review</span>Local workflow</div><h1>Review provider-shaped<br/><em>fictional fixtures.</em></h1><p className="hero-copy">No provider is connected. No delivery capability exists. Source-reported employers, public strategy-company matches, and simulation aliases remain distinct.</p><div className="notice"><span className="notice-icon">!</span><div><strong>Fixture data only</strong><small>Review changes classification state; it never verifies an email, bypasses a hard gate, or sends a message.</small></div><span className="secure">Disconnected</span></div></section>
    <section className="content-section"><div className="section-heading"><div><span className="kicker">Audited queue</span><h2>{candidates.length} imported candidates</h2></div><p>Confirm, correct from the approved taxonomy, reject, suppress, or return a record to pending review.</p></div>
      {candidates.map((candidate) => <article className="draft-card" key={candidate.id}>
        <header><div><span>{candidate.source.sourceProviderId} · {candidate.source.datasetClassification} · batch {candidate.batchId}</span><h3>{candidate.source.person.firstName} {candidate.source.person.lastName}</h3><p>{candidate.source.currentTitle} · source-reported employer: {candidate.source.currentOrganization.name}</p></div><b>{candidate.state}</b></header>
        <div className="profile-inputs"><span>review: {candidate.reviewState}</span><span>normalized: {candidate.classification.normalizedTitle}</span><span>role: {candidate.classification.specificRoleId ?? "unresolved"}</span><span>family: {candidate.classification.roleFamilyId ?? "unresolved"}</span><span>recipient: {candidate.personaId ?? "unresolved"}</span><span>experience: {candidate.experience.minimumSupportedYears ?? "?"}–{candidate.experience.maximumSupportedYears ?? "?"} ({candidate.experience.kind})</span><span>strategy match: {candidate.strategyCompanyMatch?.canonicalName ?? "none"} via {candidate.strategyCompanyMatch?.method ?? "none"}</span><span>email: {candidate.source.email.verificationStatus}</span><span>quality: {candidate.dataQualityScore}</span></div>
        <p>Gates: {candidate.gateFailures.join(", ") || "all passed"} · provenance: {Object.values(candidate.source.fieldProvenance).map((item) => item.sourceField).join(", ")}</p>
        <form action={reviewCandidateAction} className="review-actions"><input type="hidden" name="candidateId" value={candidate.id}/><label>Reason <input name="reason" required/></label><label>Correction <select name="specificRoleId"><option value="">Keep proposed role</option>{Object.keys(SPECIFIC_ROLE_TAXONOMY).map((role) => <option key={role}>{role}</option>)}</select></label>{(["confirm", "correct", "reject", "suppress", "pending"] as const).map((action) => <button key={action} name="action" value={action}>{action}</button>)}</form>
      </article>)}
    </section><footer><span>NetworkPilot</span><p>Provider-ready architecture · local fixtures only</p><span>No send control</span></footer>
  </main>;
}
