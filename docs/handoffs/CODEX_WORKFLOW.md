# Codex working agreement

Repository commits and docs are NetworkPilot's shared engineering memory. A new task must be understandable without private context from another conversation.

## Primary / Integrator

- Owns the implementation plan, main feature worktree, integration boundaries, validation, and final reporting.
- Resolves specialist/reviewer findings and commits and pushes only validated milestones.
- Prevents overlapping edits and protects production/provider boundaries.

## Specialist

- Receives one bounded subsystem with an explicit base SHA, branch, interfaces, constraints, and deliverable.
- Normally works in a separate worktree and isolated database copy.
- Does not modify unrelated files. Reports affected interfaces, validation, and commit SHA when assigned to commit.

## Independent reviewer

- Does not rubber-stamp the implementer. Preferably starts from requirements, the resulting diff, repository docs, and tests rather than implementation narration.
- Focuses on failure modes, invariants, unsafe ordering, data ownership, migration behavior, idempotency, and missing regressions.
- Normally makes no changes unless explicitly assigned correction work.

## Coordination rules

- Every implementation/review prompt names the exact base SHA and branch.
- Never have two agents modify the same worktree concurrently. Read-only investigation may run in parallel.
- Mutable integration happens through commits; share commit SHAs and affected contracts.
- Use isolated worktrees and databases for experiments, tests, and provider-shaped fixtures.
- Use stronger reasoning for architecture, safety, migrations, provider accounting, and production-state work. Lighter workers are appropriate for bounded searches, documentation checks, and focused test execution.
- Preserve history; never force-push, rebase approved shared history, or overwrite production state without explicit authority.
- Record model/runtime usage only when it is actually observable. Do not make unmeasured cost-saving or efficiency claims.
