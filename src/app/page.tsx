import { INDUSTRIES } from "@/domain/outreach";

const operatingRules = [
  { label: "Daily target", value: "15–20", detail: "qualified introductions" },
  { label: "Schedule", value: "Mon–Fri", detail: "weekends automatically paused" },
  { label: "Company cooldown", value: "7 days", detail: "one contact per company per run" },
];

const pipeline = [
  ["01", "Contact sourcing", "Disconnected", "No prospect providers are connected."],
  ["02", "Research & drafting", "Disconnected", "No AI or research services are connected."],
  ["03", "Email delivery", "Disabled", "No messages can leave this application."],
] as const;

export default function Home() {
  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="NetworkPilot home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          Network<span>Pilot</span>
        </a>
        <div className="nav-meta">
          <span className="private-label">Private workspace</span>
          <span className="mode-pill"><b /> Simulation mode</span>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="eyebrow"><span>System status</span> Safe to explore</div>
        <h1>Thoughtful outreach,<br /><em>built on relevance.</em></h1>
        <p className="hero-copy">
          NetworkPilot is preparing the foundation for focused professional networking—without
          connecting contact data, drafting services, or email delivery.
        </p>
        <div className="notice" role="status">
          <span className="notice-icon" aria-hidden="true">S</span>
          <div><strong>Simulation mode is active</strong><small>Live sending is disabled. No emails or external requests will be made.</small></div>
          <span className="secure">Isolated</span>
        </div>
      </section>

      <section className="content-section" aria-labelledby="rules-heading">
        <div className="section-heading">
          <div><span className="kicker">Operating policy</span><h2 id="rules-heading">A deliberate daily rhythm</h2></div>
          <p>Guardrails put quality, variety, and consent ahead of volume.</p>
        </div>
        <div className="rule-grid">
          {operatingRules.map((rule, index) => (
            <article className="rule-card" key={rule.label}>
              <span className="rule-number">0{index + 1}</span>
              <p>{rule.label}</p><strong>{rule.value}</strong><small>{rule.detail}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="industry-section" aria-labelledby="industries-heading">
        <div><span className="kicker">Target landscape</span><h2 id="industries-heading">Five focused industries</h2><p>Initial targeting is intentionally narrow so future outreach can stay specific and useful.</p></div>
        <ul>{INDUSTRIES.map((industry, index) => <li key={industry}><span>0{index + 1}</span>{industry}</li>)}</ul>
      </section>

      <section className="content-section pipeline-section" aria-labelledby="pipeline-heading">
        <div className="section-heading">
          <div><span className="kicker">Connection status</span><h2 id="pipeline-heading">The pipeline is offline by design</h2></div>
          <p>Each external capability remains separated behind a future authorized adapter.</p>
        </div>
        <div className="pipeline">
          {pipeline.map(([number, name, status, description]) => (
            <article key={name}><span className="pipeline-number">{number}</span><div><h3>{name}</h3><p>{description}</p></div><span className="offline"><b />{status}</span></article>
          ))}
        </div>
      </section>

      <footer><span>NetworkPilot</span><p>Foundation milestone · Simulation only</p><span>Live sending disabled</span></footer>
    </main>
  );
}
