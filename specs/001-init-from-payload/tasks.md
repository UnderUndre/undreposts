# tasks.md — undrepost (specs/001-init-from-payload)

Branch: `specs/001-init-from-payload`

## Summary

This document breaks the plan into discrete tasks, assigns agent responsibilities, and identifies parallel lanes and the critical path. Target MVP: posts, comments, member mirror, reactions counts via SSE, and basic admin flows.

## Tasks (by phase)

Phase 0 — Research & scaffolding

- T0.1 [SETUP] Setup fork worktree and branch — Backend-specialist — 0.5d
- T0.2 [BE] Validate Payload v4 beta dependencies and dev scripts — Backend-specialist — 0.5d
- T0.3 [BE] Pin Payload v4-beta build, document rebase/patch points (escape-hatch ladder), track stable tag — Backend-specialist — 0.5d — pin = upstream main at T0.1 (`7a41086106` = 4.0.0-beta.10 on 2026-11-19; beta.0 base superseded); record beta.10 workspace shape (explicit templates list + `catalog`/TS7, tracked `app/`+`app-tanstack/`) + the `apps/*` addition as patch points (review F7)
- T0.4 [BE/OPS] IdP contract-conformance spike: mint a staging Directus token, run the full 5-check validator incl. JWKS/RS256 fetch (proves the §3.2/§3.3 aud interlock before T1.3 builds on it) — Backend-specialist — 0.5d

Phase 1 — Core collections & identity

- T1.1 [DB] Implement `Members` mirror collection schema (with UNIQUE(sub) + syncedAt) — Backend-specialist — 1d
- T1.2 [BE] Implement `Posts` collection schema & basic CRUD API — Backend-specialist — 1d — wire `@payloadcms/plugin-seo` on Posts: canonical URL + OG metadata (review F3, business-plan FM-03)
- T1.3 [BE] JIT-provision endpoint + login hook (upsert Member, ON CONFLICT, re-sync claims, token validation per contract) — Backend-specialist — 2d
- T1.4 [BE] Admin bootstrap by `sub` allowlist only (no email matching) — Backend-specialist — 0.5d
- T1.5 [BE] Payload v4-beta custom auth strategy spike + opaque session bridge (login → 5-check → JIT → opaque HttpOnly session 24h/2h; admin strategy or middleware fallback; JWKS cache + last-known-good policy) — Backend-specialist — 2d — expose env seam `AUTH_STRATEGY=directus|payload-local` on the Members collection config for standalone $149-SKU builds (review F4, FR-013)

Phase 2 — Social features & SSE

# Wave-1 sequencing gate (fix 2026-11-18 review F8): P0 = T1.2 + T2.1 + T1.3 + T2.8 (+T1.4/T1.5)
# must be green before P2 social tasks start (T2.2, T2.5, T2.6, T2.3 SSE, T2.17).

- T2.1 [BE] Implement `Comments` collection (with `deletedAt` soft-delete) and relations — Backend-specialist — 1d
- T2.1b [BE] Comment gating policy: pluggable can-comment hook + rate-limit (FR-011) — Backend-specialist — 1d
- T2.2 [BE] Implement `Reactions` (emojiRef shortcode, UNIQUE(post,author,emojiRef), counters + events) — Backend-specialist — 1d
- T2.3 [OPS] SSE service: authenticated endpoint, heartbeat, replay token, per-user connection limit — Backend-specialist / DevOps (review) — 2d
- T2.4 [DB] Materialized async counters (reaction counts, poll-option counts) with index — Database-architect — 1d
- T2.4b [BE] Counter reconciliation job (idempotent, periodic drift correction from source entities) — Backend-specialist — 0.5d
- T2.5 [BE] Implement `Polls` + `PollVote` collections (UNIQUE(poll,member) constraint, results derived from votes) — Backend-specialist — 1d
- T2.6 [BE] Newsletter backend: `NewsletterSubscriber` (32-byte tokens, 24h confirm expiry, single-use unsub) + confirm/send flow — Backend-specialist — 1.5d
- T2.7 [OPS] Provision SSE infra (Redis/pubsub) for staging/dev + integration — DevOps-engineer — 1d
- T2.8 [OPS] Configure storage adapter (S3 emulation test fixture + CI) — DevOps-engineer — 0.5d
- T2.9 [BE] Input validation & typed error handling (Zod/Payload) — Backend-specialist — 1d
- T2.10 [BE] Structured logging instrumentation (pino-style) + metric emission (counters/histograms: SSE delivery latency, counter reconciliation drift, JIT provisioning outcomes, syndication send status — analyze O1) — Backend-specialist — 0.75d
- T2.11 [BE] Implement `CustomEmoji` collection + upload handling (SVG sanitization) — Backend-specialist — 1d
- T2.12a [BE] Giveaway entry + content-only winner selection (random from unique entrants) — Backend-specialist — 0.5d — optional P2
- T2.12b [BE] `status: wave-2-backlog` Giveaway product/paid winner delegation via undrlla contract — Backend-specialist — 0.5d — **do not run in Wave-1**
- T2.13b [BE] Output sanitization (DOMPurify) for rendered rich text + comments + SVG-safe emoji display — Backend-specialist — 0.5d
- T2.17 [BE] Social adapter interface + Telegram adapter (FR-045 Wave-1, P2 lane) + `SyndicationLog` dedup/retry (platform-API failure MUST NOT fail the publish — business-plan FM-02) — Backend-specialist — 1.5d — append canonical post URL to outbound syndication payloads (review F3)
- T2.18 [BE] X/Twitter adapter (FR-045, P2 optional) — Backend-specialist — 1d — optional P2
- T2.20 [BE] Member tombstone sweep job (daily: compare mirror `sub`s vs IdP active users, apply tombstones) — Backend-specialist — 0.5d — fail-closed: read-only `IDP_M2M_TOKEN` scoped to bound tenant (or signed deletion webhook); abort sweep on HTTP error / non-200 / >5% tombstone share per run (review F2)
- T2.19 [BE] `status: post-wave-1` QuestionPool status-mirror (undrepay webhook → `funded` flag; FR-046; **NO pledge ledger in undrepost** — FR-003) — Backend-specialist — 1d — gated on undrepay `INTEGRATION.md` contract

# Auction integration — WAVE-2 BACKLOG (hygiene 2026-07-30)
# status: do-not-implement for Wave-1 release; not on critical path

- T2.13 [BE] `status: wave-2-backlog` Finalize `AuctionRef` contract adapter interface and reference schema — Backend-specialist — 1d
- T2.14 [BE] `status: wave-2-backlog` Implement `AuctionRef` adapter, bid-submit adapter, and server-side contract shim — Backend-specialist — 1.5d
- T2.15 [E2E] `status: wave-2-backlog` Contract integration e2e (undrlla staging) — Test-engineer — 1.5d
- T2.16 [OPS] `status: wave-2-backlog` Cross-repo staging handshake for auctions — DevOps-engineer — 1d

Phase 3 — UI, admin, tests

- T3.1 [FE] Payload Admin customizations: posts list, member view — Frontend-specialist — 1.5d
- T3.2 [FE] Post editor and public post page component (SSE client) — Frontend-specialist — 2d — render `<link rel="canonical">` + OG tags + `/blog/rss.xml` (review F3, business-plan §2.9)
- T3.2b [FE/BE] Post list query optimization (batched author lookup, cached counts, N+1 elimination) — Frontend-specialist / Backend-specialist — 0.5d
- T3.3 [E2E] Integration tests: auth flows, JIT provisioning (incl. concurrent), SSE subscribe — Test-engineer — 2d
- T3.4 [FE] Polls UI & widget integration — Frontend-specialist — 1.5d
- T3.5 [FE] Newsletter admin UI & subscription widget — Frontend-specialist — 0.5d

Phase 4 — Hardening & release

- T4.1 [PERF] Load/scale test for SSE under realistic connections — Performance-optimizer — 1d
- T4.2 [SEC] Security review for token validation (sig/aud/iss/exp), tenant claim, admin bootstrap — Security-auditor — 1d
- T4.3 [DOC] Release notes and migration docs — Documentation-writer — 0.5d
- T4.4 [SEC] Schema audit: verify no commerce money-state persisted (pre-merge gate) — Security-auditor — 0.5d
- T4.5 [OPS] License & copyleft compliance check (runtime path) — DevOps-engineer — 0.5d
- T4.6 [OPS] Rollout & rollback runbook for production fork (plan.md Phase-4 deliverable, review F21) — DevOps-engineer — 0.5d

## Dependency Graph

# Convention: prerequisite → dependent (fixed 2026-11-18, review F9:
# T1.4 was orphaned; T2.9/T2.10/T4.1 edges were inverted; T2.12a pointed at Comments)

- T0.1 → T1.1
- T0.2 → T1.2
- T0.3 → T1.2
- T0.4 → T1.3
- T1.1 → T1.3 + T1.4 + T2.20
- T1.2 → T2.1 + T2.2 + T2.9 + T2.10 + T2.12a + T2.17 + T3.1
- T1.3 → T1.4 + T1.5 + T2.2 + T2.3 + T3.3
- T1.5 → T3.1
- T2.1 → T2.1b + T2.13b
- T2.1b → T2.2
- T2.2 → T2.3 + T2.4
- T2.4 → T2.4b + T2.3
- T2.7 → T2.3
- T2.8 → T1.2 + T2.1 + T2.11
- T2.5 → T3.4
- T2.6 → T3.5
- T2.17 → T2.18
- T3.1 → T3.2
- T3.2 → T3.2b + T3.3
- T3.4 → T3.3
- T3.5 → T3.3
- T3.3 → T4.2
- T2.3 → T3.2 + T3.3 + T4.1
- T2.7 → T4.1
- T2.11 → T2.2
- T4.4 → T4.3
- T4.5 → T4.3
- T4.6 → T4.3
# Wave-2 only (not Wave-1 edges):
# T2.13 → T2.14 → T2.15; T2.16 → T2.15; T2.12b → T2.13 + T2.14
# Post-Wave-1 (gated on undrepay contract): T2.17 → T2.19

## Agent Summary

| Tag     | Role           | Primary tasks (Wave-1)                                                                                    |
| ------- | -------------- | --------------------------------------------------------------------------------------------------------- |
| [SETUP] | Setup/Worktree | T0.1                                                                                                      |
| [BE]    | Backend        | T0.2, T0.3, T0.4, T1.2, T1.3, T1.5, T2.1, T2.1b, T2.2, T2.5, T2.6, T2.9, T2.10, T2.11, T2.12a, T2.13b, T2.17, T2.18, T2.19, T2.20 |
| [DB]    | Database       | T1.1, T2.4                                                                                                |
| [OPS]   | DevOps         | T2.3, T2.7, T2.8, T4.5, T4.6                                                                              |
| [FE]    | Frontend       | T3.1, T3.2, T3.2b, T3.4, T3.5                                                                             |
| [E2E]   | Testing        | T3.3                                                                                                      |
| [SEC]   | Security       | T4.2, T4.4                                                                                                |
| [PERF]  | Performance    | T4.1                                                                                                      |
| [DOC]   | Documentation  | T4.3                                                                                                      |

Wave-2 backlog (not Wave-1 dispatch): T2.12b, T2.13, T2.14, T2.15, T2.16
Post-Wave-1 (gated on undrepay `INTEGRATION.md` contract): T2.19

## Parallel lanes

- Lane A (Backend): T0.1 → T1.1 → T1.2 → T1.3 → T2.1 → T2.1b → T2.2 → T2.3; T0.4 precedes T1.3, T1.5 follows it
- Lane B (Frontend): T3.1 & T3.2 start once T1.2/T2.2 provide APIs; Polls/Newsletter UI follow their backend tasks
- Lane C (Ops/Infra): T2.7 & T2.8 provision infra in parallel with backend tasks
- Lane D (Tests): T3.3 runs after T1.3 & T2.3

## Critical path

JIT provisioning (T1.3) remains on the critical path because authorship relations and admin flows depend on the `Members` mirror. **Wave-1 release path:** T0.4 → T1.3 → T1.5 (session bridge) → social/SSE (T2.*) → T3.3 → T4.2/T4.4/T4.5/T4.6 → T4.3.  
**Auctions (T2.13–T2.16) are NOT on the Wave-1 critical path** (hygiene 2026-07-30).

## Total tasks & estimates

- Tasks listed: 45 total · Wave-1 primary: 39 (excl. 5 wave-2-backlog + T2.19 post-wave-1; fix 2026-11-18 review F18) · optional P2: T2.12a, T2.18
- Rough calendar estimate (MVP): 2–3 sprints (3–4 weeks) depending on resourcing and review cycles
