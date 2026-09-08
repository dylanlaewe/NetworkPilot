# Targeting and drafting strategy

## Dylan’s current target profile

Dylan graduated in May 2026 with a B.S. in Computer Science. Data and analytics roles are the highest priority, with technical/product and business/strategy/delivery roles as strong secondary paths. Industry-specific analytical roles in consulting, finance, commodities, energy, and trading provide additional focused paths. Every configured current role is early-career, associate, or realistic mid-level scope; director, VP, executive, and people-leadership titles are negative patterns rather than desired roles.

Dylan’s longer-term direction includes leadership, ownership, and responsibility where data, analytics, engineering, AI/automation, product/business problem-solving, and project/program delivery meet. This direction can inform networking questions but is explicitly disabled as current-role eligibility.

## Networking recipients

Recipient personas cover experienced practitioners, senior individual contributors, managers, functional leaders, consulting principals/partners, project/program leaders, cross-functional leaders, and selective VP-level leaders. The default scoring preference is approximately 5–20 years of experience. These are networking contacts, never job-title targets. Entry-level peers, unrelated executives, C-suite contacts, and generic recruiters are outside the default strategy.

## Industry, geography, and companies

Primary industries are technology/AI, consulting, financial services/fintech, commodities/energy markets/trading, and defense/autonomy/aerospace. Secondary industries include insurance, healthcare/life sciences, renewables, infrastructure/telecommunications, and operationally complex businesses. Boston/Massachusetts, New York City, New Jersey, and remote-friendly US opportunities receive preference; national opportunities remain viable when role and company fit are exceptional.

The public target-company registry is an editable starting strategy, not a hiring claim. It contains no people or contact details and is never used as the employer table for fictional prospects. Reviewed simulation aliases let imaginary scenarios exercise registry policy without representing anyone as a real employee. Tier 1 and Tier 2 are normally eligible, Tier 3 needs exceptional role-specific upside, and excluded, disabled, unknown, or unreviewed companies fail closed. Recognition cannot compensate for unrelated function.

## Normalization and targeting-first planning

The provider-neutral candidate contract accepts structured source fields, provenance, and a raw-record fingerprint—not arbitrary raw payloads. The application validates and deduplicates those records before producing the only intermediate allowed to construct targeting candidates: `NormalizedCandidateRecord`. It contains normalized title and experience, derived role family, desired role, recipient persona, industry, geography, company match, derived data quality, fictional scoring signals, explanations, review/rejection codes, and classification version. Fixture-supplied classification claims must agree with derivation.

Token-aware rules reject executive variants and entry-level peers without unsafe partial-word matches; selective VPs require appropriate experience, and senior recipient titles never become desired senior job roles. Domain match is preferred, a supplied unknown/conflicting domain fails closed, exact-name matching is non-fuzzy, and reviewed simulation aliases are explicit. The registry record is authoritative for tier and company score inputs; fictional employer identity remains separate.

Hard gates precede `targeting-v1` scoring. Eligible candidates rank by targeting total and stable candidate ID; legacy generic relevance does not participate. Deterministic industry and role-family soft caps encourage representation across enabled primary industries, then relax only for qualified candidates if the pool cannot fill the target. Every relaxation is persisted. One-company-per-day and seven-day cooldown remain hard.

The persisted plan owns the historical truth: versions, provenance, professional context, company match, every targeting input and component, explanations, hard-gate result, pre-diversification rank, final status, and reason. Its lifecycle is created, evaluated, planned, drafted, simulation-approved, cancelled, or failed. Draft Studio consumes selected snapshots verbatim and rejects tampered or excluded candidates.

## Deterministic composition

Eight lanes cover data practitioners, engineering, delivery/operations, consulting, finance, commodities/energy, defense/technology, and leadership career paths. Each has three substantive variants: direct/practical, career curiosity, and technical or operational common ground. They differ in opening order, approved facts, recipient framing, request, rhythm, and subject—not just synonyms.

The renderer uses only cataloged fact fragments. Each fragment declares fact IDs and builds its sentence from those values. Catalog construction derives unique ordered template fact metadata; render-time validation rejects unknown, disabled, unapproved, duplicated, or mismatched provenance. This prevents the Bresco internship, degree, graduation, or any other biography from appearing silently.

Variant selection computes FNV-1a 32-bit over `catalogVersion|runId|prospectId|lane` and takes modulo three after sorting variants by stable ID. FNV offset basis `0x811c9dc5`, prime `0x01000193`, `Math.imul`, and unsigned 32-bit normalization are explicitly tested. Time and randomness are not inputs. Drafts target roughly 70–130 words and reject configured cold-sales or generic AI phrases.

The renderer may quote one short verified fictional evidence claim and returns its evidence ID. It ignores unverified claims and never retrieves or infers data. The result includes subject, body, template/version, fact IDs, evidence IDs, generation time, and an explicit draft-only simulation status.

Fictional people and employers have their own targeting-profile tables, separate from the public registry. Seeded attributes vary across title, function, persona, experience, geography, industry, role/functional alignment, shared signal, data completeness, and fictional-company desirability. They include intentionally strong, moderate, unrelated, entry-level, outside-geography, shared-signal, and incomplete-data scenarios. These values are labeled simulation inputs, not claims about real people or companies.

At planning, references are validated against enabled configuration and reviewed registry strategy. Draft generation consumes only the persisted selected plan snapshot. It then stores content, facts, evidence, and the identical targeting context so later source edits cannot change historical review. Approval is simulation-only; provider access and delivery remain nonexistent.
