# contracts/members.contract.md — Member contract & JIT provisioning

## Purpose

Define the contract between undrepost and the authoritative IdP (undrlla) for JIT-provisioning Members and the shape of Member records used by collections.

## Token Validation (Mandatory)

Before ANY claim is trusted for JIT-provisioning or authorization, the incoming JWT MUST be fully validated:

1. **Signature**: verified against undrlla JWKS (`IDP_JWKS_URL`). Unsigned or wrong-key tokens are rejected with 401.
2. **Issuer** (`iss`): MUST match `IDP_ISSUER` config exactly.
3. **Audience** (`aud`): MUST include `undrepost` (token minted for undrepost, NOT for the marketplace). A marketplace-audience token is rejected. Canonical ecosystem tokens are minted with the full audience array including `undrepost` per `undrlla/specs/003-sso-jwt-contract/005-sso-jwt-contract.md` §3.2/§3.3 (interlock amended 2026-11-18, review F2).
4. **Expiry** (`exp`): MUST not be expired. Clock-skew tolerance: ±60s.
5. **Subject** (`sub`): MUST be present and non-empty.

Only after all 5 pass is the `sub` trusted for identity mapping.

## JIT Provisioning API (behavioral contract)

- **Trigger**: Successful OIDC authentication + full token validation (above).
- **Action**: Upsert a `Members` record where `sub == id_token.sub`.
- **Concurrency**: DB-level `UNIQUE(sub)` constraint + `INSERT ... ON CONFLICT (sub) DO UPDATE` (or equivalent). Handles concurrent provisioning from multi-tab / replay without duplicates.
- **Re-sync**: On every successful login (not just first), refresh `email`, `displayName`, `profile` from token claims. Update `syncedAt` timestamp. This prevents mirror staleness. **`roles` are NEVER claim-derived** (amendment 2026-11-18, review F3): blog roles are resolved server-side from the `sub` allowlist (see Admin bootstrap). IdP claims carry ecosystem roles (`undrlla.citizen`, `tenant.customer` — undrlla 005 §3.2) outside the mirror's `admin|member` domain; claim-derived re-sync would wipe allowlist-granted admin on every login.
- **Validation**: Verify `tenant_id` claim matches instance config; reject with 403 + audit event otherwise.

Example endpoint (internal hook) — semantics only

- `POST /api/internal/jit-provision`
  - **Auth**: `Authorization: Bearer <Directus JWT>` — the endpoint runs the full 5-check validation itself (amendment 2026-11-18, review F7). Requests without a valid token → 401.
  - **Claims source**: `sub`, `email`, `name` are extracted **exclusively from the validated token**. The request body carries no claims — a body-supplied `sub`/`roles` would allow identity spoofing or admin self-provision.
  - **Roles**: never accepted from the client; derived server-side from the `sub` allowlist.
  - Response: `200 { "memberId": "<uuid>", "created": true|false }`

## Member JSON Schema (informal)

- id: string (uuid)
- sub: string (undrlla subject, unique, DB-enforced)
- email: string
- displayName: string
- roles: ["admin"|"member"]
- profile: object
- syncedAt: string (datetime) — last re-sync
- createdAt: string (datetime)

## Contract Rules

- `sub` is authoritative for identity mapping. Do not derive identity from email alone.
- **Admin bootstrap**: matching by `sub` ONLY. Email-based allowlist is a known risk (user changes email → gains admin) and is **not permitted**. The initial bootstrap must use `sub` values from the IdP.
- Upsert must be idempotent and log `sub` + token `jti` + decision for audit; `email`/`displayName` are PII and MUST be redacted from logs (fix 2026-11-18 review F19).
- If `tenant_id` claim fails validation, return 403 and write an audit event.
- Profile fields (`email`, `displayName`, `profile`) are re-synced on every login — the mirror is eventually consistent with a per-session freshness guarantee.
- If a Member is deleted upstream, the local mirror record is retained as a tombstone (`displayName` → "[deleted]", `profile` cleared) to preserve FK integrity for authored content. No cascade delete of posts/comments. Applied by the daily sweep (T2.20) comparing mirror `sub`s against IdP active users — login re-sync alone never reaches deleted users.

## Session Bridge (Wave-1, added 2026-11-18 review F4)

- After successful login + JIT, undrepost issues an **opaque server-side session**: HttpOnly `__Secure-undrepost-session` cookie + session record (256-bit random id → Member). **Not a JWT** — the FR-014 no-local-minting rule applies to JWTs and is not violated by an opaque session.
- TTL: 24h absolute / 2h idle. All subsequent requests (front-end, SSE, Payload Admin) validate the session locally against the session store — identity is served from the Member mirror, no per-request IdP call.
- Accepted Wave-1 trade-off: IdP-side revocation propagates within ≤ 24h (session TTL). IdP outages do not kill active sessions; only new logins fail (503, user-facing message).
- JWKS verification uses a cached key set (TTL 1h) with last-known-good fallback, so signature verification survives short IdP outages.
