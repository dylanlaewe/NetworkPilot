# Gmail compose and explicit draft-send boundary

NetworkPilot selected Gmail because its official API can place an RFC 2822/MIME message into the authenticated user's Drafts folder without SMTP or browser automation. This milestone implements and tests that boundary, but authorizes no live OAuth flow and no live Gmail request.

## Product and API boundary

The provider-neutral application layer receives an explicitly approved, immutable NetworkPilot draft snapshot. That snapshot contains the professional recipient address, safe display name, subject, body, plan and draft identities, catalog version, evidence identifiers, and an idempotency identity. Gmail never selects or scores a person, calls Apollo, chooses a template, regenerates text, or modifies personalization.

The production Gmail transport allowlist contains only:

- `POST https://gmail.googleapis.com/gmail/v1/users/me/drafts` for approved draft creation.
- `POST https://gmail.googleapis.com/gmail/v1/users/me/drafts/send` only for a separately confirmed send of that exact NetworkPilot-created draft.
- `GET https://gmail.googleapis.com/gmail/v1/users/me/profile` solely to pin and verify the authenticated account identity without reading inbox content.

Draft creation sends a deterministic CRLF-compliant, plain-text MIME message encoded with base64URL in `message.raw`. It supports safe Unicode headers and rejects header injection or invalid recipients. It omits From so Gmail applies the authenticated identity, and it provides no CC, BCC, attachments, HTML, or tracking.

NetworkPilot has no generic `messages.send`, generic Gmail executor, SMTP transport, inbox reader, message listing, mailbox search, history, labels, scheduling, bulk/background sending, or reply processing. The automated `npm run check:no-email-send` scan permits the single reviewed draft-send adapter path and rejects known bypass endpoints and libraries. This is an application-level control: Google's `gmail.compose` scope can technically manage drafts and send messages, so the OAuth scope alone is not a sufficient safety boundary.

## Local desktop OAuth

The design uses Google's Desktop application OAuth client with Authorization Code + PKCE, a random state value, a ten-minute state lifetime, and an exact `127.0.0.1` loopback callback. It does not use an out-of-band flow or embedded webview. A future explicit local operator command may open the authorization URL in the system browser and temporarily listen on the configured loopback port; no automatic authorization begins at application startup.

The only requested scope is `https://www.googleapis.com/auth/gmail.compose`. Returned scopes must equal that exact singleton set. Refresh preserves the original scope when Google omits `scope` from a refresh response, rejects any broader returned set, handles expiration, and clears secret state on `invalid_grant`. Disconnect attempts token revocation and always deletes local token state.

Access and refresh tokens are stored behind a storage-neutral secret interface. The included macOS implementation uses the login Keychain via the operating-system `security` utility and has no plaintext fallback on unsupported platforms. SQLite stores only non-secret connection metadata: account identity when confirmed, exact granted scopes, lifecycle state, and timestamp. OAuth client configuration is injected server-side; `.env.local` and downloaded credential files remain untracked.

The account is discovered with the minimal Gmail profile endpoint available to the granted compose scope, then persisted in Keychain and non-secret connection metadata. Future draft creation fails closed until an unambiguous account is pinned. No inbox scope is requested merely to discover identity.

## Idempotency and uncertain outcomes

Approval creates a durable operation from the immutable snapshot:

`approved-for-gmail-draft` → `creating-gmail-draft` → `gmail-draft-created`

The operation records its deterministic NetworkPilot identity, immutable approved snapshot, provider, adapter version, attempt time, provider draft/message identifiers, completion time, and safe error category. It never stores OAuth tokens. Once provider identifiers are confirmed, retries return the existing operation without another POST.

POST requests are never automatically retried. If a timeout, transport loss, rate limit, server response, or malformed success leaves creation uncertain, the operation enters `reconciliation-required`; another automatic POST is blocked. A definitive failure can enter `failed`, but still requires a later explicit operator action. Reconciliation tooling is deliberately deferred.

Sending uses a second persisted state machine: `not-sent` → `sending` → `sent` or `send-status-uncertain`. The application rechecks immutable identity, suppression, opt-out, prior contact, hard bounce, company cooldown, account pinning, exact compose scope, runtime credentials, and exact Gmail draft identity immediately before the send. A double click or repeated request cannot create a second provider call. Any uncertain provider result blocks retry pending reconciliation. Gmail-confirmed success records its protected response identity and creates an awaiting-response contact record with `networkpilot-gmail-send` provenance. The external manual-confirmation workflow remains available and unchanged.

`NETWORKPILOT_GMAIL_ENABLED` defaults to `false`. When disabled, authorization, token refresh, identity discovery, draft creation, and draft sending fail before external activity. Reply-aware behavior would require separate scope, privacy, and product review.

Future optional reconciliation of email sent outside NetworkPilot could evaluate the narrow `gmail.metadata` scope and history metadata without reading bodies. It is not implemented in v1.1; no mailbox-reading scope is requested.

For an explicitly Headquarters-authorized controlled validation, the local-only command is `NETWORKPILOT_GMAIL_ENABLED=true npm run gmail:controlled-live -- /absolute/path/to/client-secret.json`. The credential must be a Google Desktop client JSON stored outside the repository. The command never prints its values, permits one profile request and at most two draft-create requests, validates MIME before each POST, refuses a repeated validation after its durable start marker, and makes no Apollo request. The repository default remains disabled.

The separately authorized human-reviewed pilot uses `gmail:human-reviewed-pilot`. It reuses the immutable operational-scale plan and drafts, rechecks mutable suppression, opt-out, contact, cooldown, and prior-Gmail-operation gates, selects no more than eight companies with diversity preference, and validates all MIME locally before enabling its one profile and eight draft-create caps. NetworkPilot places approved drafts into Gmail; Dylan alone visually reviews, edits, and decides whether to send them manually. Draft creation never implies a send.

## Reauthorization and uncertain-send reconciliation

When a refresh token is revoked or expires with `invalid_grant`, NetworkPilot deletes the unusable Keychain entry and persists `reauthorization-required`. The Today page then offers **Reconnect Gmail**. This starts the same loopback Authorization Code + PKCE flow, requests only `gmail.compose`, stages the returned credential in memory, and verifies the account through the compose-scope profile endpoint. Only the already-pinned account may be committed to macOS Keychain; a different account or any failed flow leaves readiness unchanged. SQLite receives only connected-state metadata, a hash of the account identity, the exact scope list, and an append-only reauthorization audit event.

An explicit send that lacks a terminal provider result is never retried. The Today page instead offers **Resolve Send Status**. The operator must inspect Gmail and may record sent with the actual timestamp, record not-sent, or leave the state uncertain. Sent reconciliation records awaiting response and normal cooldown with `operator-reconciled-sent` provenance; not-sent reconciliation returns the immutable draft to normal mutable-gate evaluation without sending it. Reconciliation never calls Gmail and never fabricates `gmail-send-confirmed` evidence.

## Human-reported manual outreach

First list the persisted Gmail-created operations and copy the stable `npms-…` operator ID:

```bash
npm run manual-send:list
```

The list is read-only and privacy-safe: it shows a redacted recipient, company, title, subject, Gmail-draft status, manual-attempt status, effective sent time, persisted outcome, suppression, and derived response state. A hard bounce therefore remains visibly distinct from a normal awaiting-response contact even though both have a confirmed manual attempt. It never prints recipient addresses, Gmail IDs, Apollo IDs, tokens, immutable snapshot IDs, or operation IDs. By default both operator commands use the explicit pilot datastore `data/apollo-operational-scale-enrichment.sqlite`. A deliberate alternative may be supplied only with `NETWORKPILOT_MANUAL_OUTREACH_DATABASE_PATH`; the generic application database setting is ignored, and the selected sanitized path is printed.

After Dylan independently presses Send in Gmail, this local-only command can record that fact. It makes no Gmail request, does not inspect Sent Mail, and cannot deliver anything:

```bash
npm run manual-send:confirm -- \
  --id '<npms-id from manual-send:list>' \
  --sent-at '2026-09-10T14:30:00.000Z' \
  --confirm-i-sent-this-in-gmail
```

The explicit phrase is required. The operation is `operator-confirmed-manual-send`, never provider-confirmed delivery. It records the immutable snapshot and Gmail operation identities, resolved prospect/company identities, confirmation and effective-send timestamps, source `operator`, version, initial `awaiting-response` outcome, and one audit event. Repeating it returns the existing record without another event or second cooldown.

Future outcomes are also human-reported with `npm run manual-outreach:outcome -- --id '<npms-id>' --outcome replied`. Supported ordinary values are `awaiting-response`, `replied`, `meeting-scheduled`, `declined`, `opt-out`, and `no-response`. An opt-out creates an ordinary suppression immediately. Metrics count these states against the explicit denominator `operator-confirmed-manual-send` and expose the first/last effective-send observation window; they do not claim a reply rate.

An immediate address-not-found failure uses a stricter atomic command after the operator has manually pressed Send:

```bash
npm run manual-send:bounce -- \
  --id '<npms-id>' \
  --sent-at '2026-09-10T12:32:00-04:00' \
  --confirm-i-received-address-not-found
```

This records the manual attempt, terminal human-reported `hard-bounce` outcome, durable candidate/address suppression, and two audit events in one transaction. It makes no provider call. Repeating it is idempotent. A hard bounce permanently blocks the bad candidate/address but, because it did not reach the recipient, its company cooldown lasts only through that campaign-local calendar day. Normal confirmed manual sends retain the full configured seven-day company cooldown. The same-day rule prevents immediately moving to another employee after a failure without misrepresenting the bounce as successful company contact.

## Optional metadata reconciliation

v1.2 includes exact-match architecture for reconciling a NetworkPilot-owned Gmail draft after a manual Gmail send. It is disabled by default behind `NETWORKPILOT_GMAIL_METADATA_RECONCILIATION_ENABLED=true` and does not change the current `gmail.compose` authorization. Enabling it in a future controlled deployment would require the restricted `gmail.metadata` scope and could add Google verification friction. It must inspect metadata only for persisted NetworkPilot-owned identifiers, never bodies or general inbox content, and ambiguous matches are a no-op. The **I already sent this** fallback remains available regardless of this flag.
