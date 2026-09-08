# NetworkPilot architecture

## Guiding principles

NetworkPilot is designed around a provider-independent domain layer. Business policy must remain testable without a browser, database, network, vendor SDK, or wall clock. External systems will be integrated only through explicit, authorized adapters. Simulation remains the default until live capabilities are separately designed, reviewed, and approved.

## Current foundation

The App Router dashboard in `src/app` presents operating status and policy. The pure domain module in `src/domain/outreach` owns prospect types and daily selection. Its caller injects the current time and randomness, making weekday behavior and daily targets deterministic in tests. The domain module contains no UI, persistence, provider, scraping, or delivery logic.

## Planned components

### Dashboard

The private operator interface will show run readiness, qualification outcomes, draft-review queues, send limits, replies, and suppression status. It should invoke application use cases rather than provider SDKs directly and make simulation/live state unmistakable.

### Authorized prospect-source adapter

An adapter boundary will accept records only from a source the operator is authorized to use. It will normalize them into domain `Prospect` values and record provenance. No LinkedIn or CareerShift scraping or browser automation is planned or permitted. Provider-specific credentials and payloads must stay outside the domain layer.

### Qualification engine

The qualification engine will apply consent, suppression, verified-email, experience, industry, company-diversity, cooldown, and prior-contact policies. The current daily selector is the first part of this component. Later relevance scoring should remain explainable and auditable.

### Research and drafting engine

This component will assemble authorized research context and produce an editable draft through a future AI adapter. It must preserve citations/provenance, avoid unsupported claims, and require product-approved review rules before a draft can advance.

### Scheduler

The scheduler will create weekday runs, enforce the randomized daily cap, store an immutable run record, and coordinate idempotent work. Clock and randomness interfaces will remain injectable. It must stop safely when dependencies or policy checks fail.

### Email adapter

A future adapter will translate approved send commands to an authorized email provider. It will be isolated from selection and drafting, enforce idempotency, and expose delivery outcomes. Live delivery is absent and disabled in the current milestone.

### Reply processor

The reply processor will normalize authorized mailbox events, associate replies with outreach, classify workflow state, and surface positive responses for human attention. Provider-specific webhook or polling details will remain behind the adapter.

### Suppression system

Suppression is a hard policy boundary checked before selection and again before any future delivery. It will combine person-level opt-outs, invalid-address signals, and administrative blocks with an audit trail. A later implementation should favor immediate, fail-closed updates.

### Provider-independent domain layer

Domain types, policies, and use cases must not import framework code or vendor SDKs. Provider adapters will map external values at the application boundary. This keeps policy reusable, makes simulations representative, and allows vendors to change without rewriting core rules.

## Proposed flow

1. An authorized source adapter normalizes permitted prospects.
2. Qualification and selection apply domain policy to create a daily run.
3. Research and drafting prepare reviewable material through an approved adapter.
4. The scheduler advances approved work within weekday and volume limits.
5. The email adapter delivers only when live mode is explicitly enabled in a future milestone.
6. The reply processor records outcomes while the suppression system can halt future contact at every stage.

Persistence, authentication, authorization, secrets management, audit logging, and live-provider threat modeling must be specified before any integration is enabled.
