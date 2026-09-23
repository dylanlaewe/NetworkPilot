# Agent and Model Usage

## Controlled experiment

The coordinator owned scope, integration, browser evidence, final validation, Git, and reporting. Two workers ran concurrently initially; dependent independent QA began only after the implementation worker completed. Workers were explicitly prohibited from recursive delegation.

| Role | Requested available model | Requested reasoning | Scope |
| --- | --- | --- | --- |
| Product/copy reviewer | `gpt-6-luna` | high | Read-only semantic/copy review and one findings document |
| Interface implementer | `gpt-6-astra` | high | Isolated prototype route, styles, model, fixtures, and focused tests |
| Independent QA reviewer | `gpt-6-sol` | high | Browser/adversarial/accessibility review and one findings document |

The collaboration runtime exposed `gpt-6-astra`, `gpt-6-sol`, `gpt-6-luna`, and older compatible model choices. The table records the model/configuration explicitly requested by the coordinator when each worker was created. The worker-local interfaces did not expose a separate runtime model identifier, so no stronger identity claim is made.

Token counts, monetary usage, and dollar savings were not observable. No separately billed API, external agent platform, or model API was used, so no cost claim is made.

## Skills and capabilities

The coordinator inspected the installed skill catalog and repository guidance. No existing skill specifically covered this narrow five-bucket acceptance workflow. A new general-purpose skill was not created because the approved work was project-specific and is captured more clearly by the versioned product brief, interaction specification, canonical fixtures, regression tests, and independent QA checklist in this package. Global configuration and permissions were unchanged.
