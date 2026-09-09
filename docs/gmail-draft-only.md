# Gmail draft-only boundary

NetworkPilot selected Gmail because its official API can place an RFC 2822/MIME message into the authenticated user's Drafts folder without SMTP or browser automation. This milestone implements and tests that boundary, but authorizes no live OAuth flow and no live Gmail request.

## Product and API boundary

The provider-neutral application layer receives an explicitly approved, immutable NetworkPilot draft snapshot. That snapshot contains the professional recipient address, safe display name, subject, body, plan and draft identities, catalog version, evidence identifiers, and an idempotency identity. Gmail never selects or scores a person, calls Apollo, chooses a template, regenerates text, or modifies personalization.

The production Gmail transport allowlist contains only:

- `POST https://gmail.googleapis.com/gmail/v1/users/me/drafts` for future draft creation.
- `GET https://gmail.googleapis.com/gmail/v1/users/me/profile` solely to pin and verify the authenticated account identity without reading inbox content.

Draft creation sends a deterministic CRLF-compliant, plain-text MIME message encoded with base64URL in `message.raw`. It supports safe Unicode headers and rejects header injection or invalid recipients. It omits From so Gmail applies the authenticated identity, and it provides no CC, BCC, attachments, HTML, or tracking.

NetworkPilot has no Gmail send method, generic Gmail executor, SMTP transport, inbox reader, message listing, mailbox search, history, labels, scheduling, or reply processing. The automated `npm run check:no-email-send` scan protects the application source against known delivery endpoints and libraries. This is an application-level control: Google's `gmail.compose` scope can technically manage drafts and send messages, so the OAuth scope alone is not a sufficient safety boundary.

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

`NETWORKPILOT_GMAIL_ENABLED` defaults to `false`. When disabled, authorization, token refresh, identity discovery, and draft creation fail before external activity. A separately reviewed milestone must authorize the first OAuth connection and tiny live draft validation. Reply-aware behavior would require separate scope, privacy, and product review.
