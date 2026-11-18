# Implementation Plan — undrepost: Initialize from Payload

Feature branch: `specs/001-init-from-payload`

## Summary

This plan implements the `undrepost` migration: fork `payload` (payload-monorepo; base pinned at T0.1 to upstream main = 4.0.0-beta.10 `7a41086106`, 2026-11-19 — beta.0 → beta.10 is 850 upstream commits, sync-before-implement decided), re-platform legacy `underblog` features onto Payload collections, and add the social features and contracts described in the spec.

Primary goals

- Keep divergence small from upstream Payload (Sync fork strategy).
- Provide a local `Members` mirror (JIT-provisioned from undrlla IdP) as the canonical author/member reference for undrepost collections.
- Implement SSE-based social counts (reactions/polls) with heartbeat/replay and connection limits.
- Deliver a minimal MVP (posts, comments, reactions counts, admin UI, Member mirror).

## Technical Context

- Platform: PayloadCMS forked monorepo (app/collection layer customizations).
- Identity: **undrlla Directus** IdP is authoritative (JWT/JWKS per ecosystem `005`); undrepost maintains a local `Members` mirror created on first login using IdP `sub` / Directus user id and caching role/profile. Re-synced on every login. **Not** Better-Auth.
- Tenancy: Single-tenant per deploy (validate IdP claim `tenant_id` against instance config).
- Real-time: SSE endpoint for social counts. Backend holds counts and publishes deltas; clients subscribe to updates for optimistic UI.

## Key Design Decisions

- Members mirror (local collection) instead of remote lookups to simplify FK relations and queries.
- JIT provisioning endpoint: on successful OIDC login + full token validation (signature/aud/iss/exp), upsert mirrored Member record. ON CONFLICT semantics for concurrency safety.
- SSE design: authenticated endpoint, heartbeat pings, reconnection with replay token (per-feed last-seq), and connection limits per user + per IP.
- Audit & roles: Bootstrap admin by `sub` allowlist only (no email matching — security risk per review). Validate against IdP claim.

## Auth & Session Architecture (added 2026-11-18, review F4/F10)

- **Login**: OIDC authorization-code + PKCE against `id.undrlla.network` → 5-check token validation (members.contract.md) → JIT upsert → **opaque server-side session**: HttpOnly `__Secure-undrepost-session` cookie + session record (256-bit random id) referencing the Member. **No locally-minted JWT** — FR-014's prohibition covers JWTs and is not violated by an opaque session. Session TTL / revocation-latency trade-off: authoritative values in `contracts/members.contract.md` §Session Bridge (D1 dedupe, 2026-11-19).
- **Subsequent requests** (public front-end, SSE, admin): session cookie validated against the session store; identity served from the local Member mirror — no per-request IdP call.
- **Payload Admin**: custom auth strategy validating the same session (spike T1.5 verifies the v4-beta strategy API; fallback = middleware guard on `/admin`). Admin bootstrap via `sub` allowlist unchanged.
- **IdP outage behavior**: JWKS cached (TTL 1h) with last-known-good fallback for signature verification; active sessions unaffected (login-time validation only); new logins fail 503 with a user-facing message. The Wave-1 availability claim (spec Waves) holds by construction.
- **IdP-deleted members**: daily sweep (T2.20) compares mirror `sub`s against IdP active users and applies tombstones — login re-sync alone never reaches deleted users (review F11).

## Deliverables / Artifacts

- `plan.md` (this file)
- `tasks.md` (task breakdown & agent dispatch)
- `data-model.md` (collection schemas)
- `contracts/members.contract.md` (auth/Member contract & JIT API)
- `quickstart.md` (dev startup steps)

## Implementation Phases

Phase 0 — Research & scaffolding (2.5–3.5 days)

- Validate upstream Payload version and fork strategy.
- Pin beta build, document rebase/patch points, track stable tag (T0.3).
- IdP contract-conformance spike (T0.4): mint a staging Directus token, run the full 5-check validator incl. JWKS/RS256 — proves the aud interlock before T1.3 builds on it.
- Create repo worktree, branch `specs/001-init-from-payload` (branch renamed from `spec/…` to the constitution `specs/` convention, 2026-11-18).
- **Blog app location (pinned 2026-11-18, review F15): `apps/undrepost/`** — a new top-level pnpm workspace; upstream payload-monorepo has no `apps/` dir, so the Sync-fork collision surface is zero by construction. SC-003/SC-004 conflict claims now reference this path. Re-checked on beta.10 (2026-11-19): upstream tracks singular `app/` + `app-tanstack/` dev apps — `apps/` still absent. **Base pin (T0.1)**: fork `main` fast-forwards to upstream main `7a41086106` (4.0.0-beta.10) before implement; `pnpm-workspace.yaml` on beta.10 uses an explicit templates list + `catalog` (TS7 native) instead of the beta.0 `templates/*` glob — record both shapes plus the `apps/*` addition as rebase/patch points (T0.3, review F7).
- Generate skeleton collections and minimal app/collection layer under `apps/undrepost/`.

Phase 1 — Core collections & identity (3.5–5.5 days)

- Implement `Members` mirror collection (with UNIQUE(sub) + syncedAt) and `Posts` collection schema.
- Add JIT-provisioning flow: on IdP login, upsert Member (ON CONFLICT, re-sync claims).
- Add admin bootstrap by `sub` allowlist.

Phase 2 — Social features & SSE (5–7 days)

- Implement `Reactions` (emojiRef shortcode, UNIQUE triple), `Comments` (soft-delete), `Polls` + `PollVote` collections and relations.
- Implement comment gating policy (can-comment hook + rate-limit).
- Implement SSE feed service: authenticated endpoint, counts, playback/replay, heartbeat.
- Async materialized counters with periodic reconciliation job.
- Output sanitization (DOMPurify) for rendered content.
- Social adapter interface + Telegram adapter + SyndicationLog (FR-045, P2 lane); QuestionPool status-mirror (FR-046, post-Wave-1, gated on undrepay contract).
- Member tombstone sweep job (daily, T2.20).
- Metrics emission alongside structured logging (T2.10, analyze O1): SSE delivery latency, counter reconciliation drift, JIT provisioning outcomes, syndication send status.

Commerce integration (Wave-2 — **not** Wave-1 release gate)

- Hygiene 2026-07-30: FR-030 auctions and product/paid giveaways are **deferred**. Wave-1 GA does **not** require undrlla auction staging or T2.13–T2.16.
- When undrlla defines an auction FR, promote T2.13–T2.16 from backlog and re-open a Wave-2 feature slug.

SSE reliability defaults (to be tuned in plan):

- Heartbeat interval: 15s
- Replay window: support `Last-Event-ID` replay for last 100 events per feed
- Replay miss behavior: if `Last-Event-ID` is older than the 100-event window, send a `snapshot` event (current state) followed by live deltas. Client catches up via snapshot, no silent gap.
- Connection caps: 5,000 concurrent connections per instance with per-user limit (5 sessions) and per-IP soft-limit at 50 connections and a backpressure policy.
- Authentication: SSE endpoint requires valid token (membership). Unauthenticated SSE is rejected at the transport layer — no anonymous subscription.

Comment gating & newsletter defaults (tunable config, added 2026-11-18 review F12):

- Comment gating default: confirmed member + 10 comments/hour/member (Redis-backed sliding counter); rejection returns a user-facing message, never a silent drop.
- Newsletter transport: Resend (DKIM/SPF on the instance sending domain); bounce webhook → auto-unsubscribe; send retry ×3 exponential backoff; unsubscribe single-use idempotent.

Storage & infra tasks added:

- Configure S3-compatible storage adapter for media uploads; include S3 emulator in CI.
- Provision Redis/pubsub for SSE in staging; fallback to in-process pubsub in single-node dev.

Phase 3 — UI, admin, tests (3.5–5.5 days)

- Build minimal Post editor + Admin dashboards (Payload admin customizations + React where needed).
- Add client SSE integration and optimistic updates.
- Post list query optimization (batched author lookup, cached counts, N+1 elimination).
- Add unit/integration tests and Playwright e2e for core flows.

Phase 4 — Hardening & release (2–4 days)

- Performance tuning, indexes, rate-limits, security review, docs.
- Create rollout & rollback plan for production fork.

## Acceptance Criteria (MVP)

- Can create/edit/delete Posts with author FK to local Member mirror.
- JIT provisioning successfully creates Member on IdP login (idempotent under concurrent requests).
- Comments persist with soft-delete; gating policy enforces can-comment + rate-limit.
- Reactions persist with per-emoji uniqueness; counts update via SSE within ~1s under normal load.
- Polls enforce one-vote-per-member; results derived from PollVote.
- Admin can manage posts and members via Payload admin.
- SSE requires authentication; unauthenticated connections rejected.

## Risks & Mitigations

- Upstream drift: Keep customization confined to `app/collection` layer; document patch points and rebase strategy. Pin beta build + track stable tag (T0.3).
- Identity mismatch: Validate claims (sig/aud/iss/exp) and include an audit log for JIT provisioning; fail-fast on tenant mismatch. Admin bootstrap by `sub` only.
- SSE scale: in-process pubsub for single-node dev; Redis/pubsub provisioned for staging/prod (T2.7). Per-user connection limit prevents single-user fan-out abuse. Metrics (T2.10) expose delivery latency and connection counts.
- XSS: DOMPurify sanitization on rendered rich text/comments; SVG-safe emoji handling (T2.13b).

## Constitution Check

This feature is built within the `underhelpers/undrepost` repo, which uses the `clai-helpers` constitution (`.specify/memory/constitution.md` v1.5.0). The applicable product-level principles are:

- **Principle VI** (Cross-AI Review Gate): implementation blocked until `analyze.md` PASS + ≥2 external reviewer PASS.
- **Principle VII** (Artifact Versioning): every speckit stage tagged via snapshot scripts.
- **Principle IX** (Two-Phase Review Flow): `specs/<slug>` planning branch; implementation branch created after planning merge.

Product-specific concerns (payment boundary, PII handling, auth posture) are governed by `spec.md` FR-\* requirements + this plan's design decisions, NOT by a separate product constitution. If product-level governance is needed, a product constitution should be authored as a separate decision (flagged by review F11-claude).

## Next steps

1. Run T0.4 IdP contract-conformance spike (5-check validator vs a staging-minted token incl. JWKS/RS256).
2. Create the collections and JIT endpoint skeleton (`Members`, `Posts`) under `apps/undrepost/`.
3. Implement **Directus** identity flow: T1.5 session bridge + admin bootstrap (`sub` only; JWKS validation).
4. Build Reaction counters (async + reconciler), SSE feed, and the social adapter interface + Telegram adapter (T2.17).
5. Wave-1 release: schema money-state audit + license check + metrics emission — **no** auction gate.
6. Run integration tests and basic load test on SSE.
7. (Post-Wave-1) T2.19 QuestionPool status-mirror when undrepay `INTEGRATION.md` is live.
8. (Later / Wave-2) Auction contract + T2.13–T2.16 when undrlla engine exists.

---

Generated artifacts: `data-model.md`, `contracts/members.contract.md`, `quickstart.md`, `tasks.md`.
