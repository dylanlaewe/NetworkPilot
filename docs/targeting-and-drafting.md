# Targeting and drafting strategy

## Dylan’s current target profile

Dylan graduated in May 2026 with a B.S. in Computer Science. Data and analytics roles are the highest priority, with technical/product and business/strategy/delivery roles as strong secondary paths. Industry-specific analytical roles in consulting, finance, commodities, energy, and trading provide additional focused paths. Every configured current role is early-career, associate, or realistic mid-level scope; director, VP, executive, and people-leadership titles are negative patterns rather than desired roles.

Dylan’s longer-term direction includes leadership, ownership, and responsibility where data, analytics, engineering, AI/automation, product/business problem-solving, and project/program delivery meet. This direction can inform networking questions but is explicitly disabled as current-role eligibility.

## Networking recipients

Recipient personas cover experienced practitioners, senior individual contributors, managers, functional leaders, consulting principals/partners, project/program leaders, cross-functional leaders, and selective VP-level leaders. The default scoring preference is approximately 5–20 years of experience. These are networking contacts, never job-title targets. Entry-level peers, unrelated executives, C-suite contacts, and generic recruiters are outside the default strategy.

## Industry, geography, and companies

Primary industries are technology/AI, consulting, financial services/fintech, commodities/energy markets/trading, and defense/autonomy/aerospace. Secondary industries include insurance, healthcare/life sciences, renewables, infrastructure/telecommunications, and operationally complex businesses. Boston/Massachusetts, New York City, New Jersey, and remote-friendly US opportunities receive preference; national opportunities remain viable when role and company fit are exceptional.

The public target-company registry is an editable starting strategy, not a hiring claim. It contains no people or contact details and is never used as the employer table for fictional prospects. Tier 1 is marquee, Tier 2 is highly respected or especially compelling, Tier 3 needs exceptional role-specific upside, and excluded/unreviewed companies fail the default gate.

## Deterministic composition

Eight lanes cover data practitioners, engineering, delivery/operations, consulting, finance, commodities/energy, defense/technology, and leadership career paths. Each has three substantive variants: direct/practical, career curiosity, and technical or operational common ground. They differ in opening order, approved facts, recipient framing, request, rhythm, and subject—not just synonyms.

The renderer uses only cataloged fact fragments. Each fragment declares fact IDs and builds its sentence from those values. Catalog construction derives unique ordered template fact metadata; render-time validation rejects unknown, disabled, unapproved, duplicated, or mismatched provenance. This prevents the Bresco internship, degree, graduation, or any other biography from appearing silently.

Variant selection computes FNV-1a 32-bit over `catalogVersion|runId|prospectId|lane` and takes modulo three after sorting variants by stable ID. FNV offset basis `0x811c9dc5`, prime `0x01000193`, `Math.imul`, and unsigned 32-bit normalization are explicitly tested. Time and randomness are not inputs. Drafts target roughly 70–130 words and reject configured cold-sales or generic AI phrases.

The renderer may quote one short verified fictional evidence claim and returns its evidence ID. It ignores unverified claims and never retrieves or infers data. The result includes subject, body, template/version, fact IDs, evidence IDs, generation time, and an explicit draft-only simulation status.

Fictional people and employers have their own targeting-profile tables, separate from the public registry. Seeded attributes vary across title, function, persona, experience, geography, industry, role/functional alignment, shared signal, data completeness, and fictional-company desirability. They include intentionally strong, moderate, unrelated, entry-level, outside-geography, shared-signal, and incomplete-data scenarios. These values are labeled simulation inputs, not claims about real people or companies.

At generation, references are validated against enabled domain configuration and public company IDs are prohibited. The score consumes only the persisted recipient-specific profile. The draft then snapshots all input values, components, explanations, versions, facts, and evidence so later source edits cannot change historical review.
