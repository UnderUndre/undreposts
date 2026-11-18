# SpecKit Analyze: 001-init-from-payload

**Reviewer**: analyze (ZCode / GLM-5.3-Flash self-consistency)
**Reviewed at**: 2026-11-18T21:20:00+04:00
**Commit**: c45fa2ba466c72670b3032393d6af265f8d0c0cd — **note: working tree is ahead of HEAD** (uncommitted fix-pass 2026-11-18 applying reviews/zcode.md F1–F21; this analysis evaluates the working tree, not the commit)
**Artifacts**: spec.md, plan.md, tasks.md, data-model.md, contracts/members.contract.md, quickstart.md
**Supersedes**: analyze.md 2026-06-23 (CRITICAL @ NO_GIT — stale: CR-AU was resolved by hygiene 2026-07-30 and the 2026-11-18 fix-pass)

## Findings

| ID  | Category      | Severity | Location(s) | Summary | Recommendation |
| --- | ------------- | -------- | ----------- | ------- | -------------- |
| O1  | Ops readiness (pass M) | **HIGH** | tasks.md T2.10, plan.md Phase 4 | Structured logging exists (FR-041/T2.10), rollback runbook now exists (T4.6), but **no metric emission / tracing task** — SSE latency (plan acceptance "~1s"), counters drift, syndication failures are unmeasurable in prod. Pass M flags missing telemetry as HIGH. | Extend T2.10 to include metric emission (counters/histograms: SSE latency, counter drift, JIT provisioning outcome, syndication status) or add T2.10b; no full OTel stack required for Wave-1 — one metrics surface is enough. |
| G1  | Agent routing (pass G) | MEDIUM | tasks.md Dependency Graph | **T4.2 (SEC security review) is orphaned** — no edges in the graph (survivor of the same defect class as the old T1.4 orphan fixed in the fix-pass). Security review ordering vs T1.3/T1.5/T3.3 is unwired. | Add `T3.3 → T4.2` (security review after integration tests) or `T1.5 → T4.2`. |
| C1  | Constitution (VII) | MEDIUM | git state | The 2026-11-18 fix-pass mutated all five artifacts **without stage tags and without commit** — Principle VII requires `<stage>/<slug>/v<N>` tags per mutating stage. HEAD (c45fa2ba) predates the fixes, so tagging now would pin the wrong tree. | Commit the fix-pass, then tag `plan/001-init-from-payload/v1` + `tasks/001-init-from-payload/v1` at the fix commit. |
| K1  | Spike governance (pass K) | MEDIUM | tasks.md T0.4, T1.5 | Two spike tasks (IdP conformance, custom-auth strategy) have **no `research.md`** — no numerical verification metrics (JWKS fetch latency, token validation p95) and no explicit Spike Disposal Path (throwaway vs promote). | Create `research.md` documenting both spikes: success metrics (e.g., 5-check validator p95 < 50ms; strategy API exists/absent) + disposal decision rule. |
| I1  | Inconsistency | LOW | spec.md Waves vs FR-046 | FR-046 self-labels "post-Wave-1" but the Waves section lists only Wave 1 / Wave 2 — the bucket FR-046 lives in is unnamed there. | Add one line to Wave 2: "post-Wave-1 (undrepay-gated): FR-046 (T2.19)". |
| D1  | Duplication | LOW | spec.md FR-014 / plan.md Auth section / contract Session Bridge | Session-bridge parameters (24h/2h, HttpOnly, opaque) are stated in three documents. Values currently identical; three copies = three drift targets. | Single source: contract §Session Bridge is authoritative; spec/plan reference it by pointer instead of restating TTLs. |
| U1  | Underspecification | LOW | spec.md FR-046 | The rewrite silently dropped the original "private answer premium" option without a note — scope reduction not recorded. | Either restore as "premium/private-answer handling is an undrepay-side product, out of undrepost scope" or add a dated drift note. |
| U2  | Underspecification | LOW | data-model.md QuestionPool | `funded` (boolean) and `status` (open\|funded\|answered) encode the same state twice. | Drop the boolean, derive from `status`, or document the invariant (`funded == status ∈ {funded, answered}`). |
| I2  | Inconsistency | LOW | plan.md Next steps, Risks | "Next steps" list predates the fix-pass (no T0.4/T1.5/T2.17); Risks still says "Start with in-process SSE for Wave 1" while infra tasks provision Redis/pubsub for staging. | Refresh both bullets: insert session-bridge/conformance steps; align SSE topology wording (in-process dev, Redis staging/prod). |
| H1  | Commercial (pass H) | LOW | business plan §1 vs FR-046 | Business-plan topology lists FR-046 as an engine capability; spec parks it post-Wave-1 gated on undrepay. Not SKU drift ($149 = auto-poster + newsletter — covered by T2.17/T2.6), but the BP should not promise a dated feature. | Add alias/note line to BP changelog: FR-046 lands post-Wave-1, undrepay-gated. |

No CRITICAL findings. No duplication of requirements, no unresolved placeholders, no circular dependencies, no shared-file agent conflicts, no copyleft dependencies introduced (Resend = commercial SaaS; adapters are isolated per FM-02).

## Coverage Summary

| Requirement Key | Has Task? | Task IDs | Notes |
| --------------- | --------- | -------- | ----- |
| FR-001 (fork discipline) | Yes | T0.1, T0.3 | |
| FR-002 (license clean) | Yes | T4.5 | release gate |
| FR-003 (no money-state) | Yes | T4.4 | + FR-046 rewrite enforces boundary |
| FR-004 (single-tenant) | Yes | T1.3 | tenant claim validation |
| FR-005 (Directus IdP) | Yes | T0.4, T1.3 | T0.4 proves interlock first |
| FR-006 (Wave-1 scope) | Yes | phases + P0 gate note | |
| FR-010 (posts) | Yes | T1.2, T3.1, T3.2 | |
| FR-011 (comments+gating) | Yes | T2.1, T2.1b | defaults in plan.md |
| FR-012 (media S3) | Yes | T2.8 | |
| FR-013 (pluggable adapters) | Yes (implicit) | T1.5 (auth), T2.1b (gating), T2.8 (storage), T2.17 (syndication) | each pluggable axis has a task; previous "Partial" resolved |
| FR-014 (IdP/session) | Yes | T0.4, T1.3, T1.5 | session bridge specced |
| FR-020 (reactions) | Yes | T2.2, T2.4, T2.4b | |
| FR-021 (custom emoji) | Yes | T2.11 | |
| FR-022 (polls) | Yes | T2.5, T3.4 | |
| FR-023 (newsletter) | Yes | T2.6, T3.5 | transport default: Resend |
| FR-030 (auctions) | Deferred | T2.13–T2.16 (`wave-2-backlog`) | not a Wave-1 gate (F1 fixed) |
| FR-031 (giveaways) | Yes | T2.12a; T2.12b deferred | |
| FR-032 (paid membership) | n/a | — | out of scope by design |
| FR-040 (input validation) | Yes | T2.9 | |
| FR-041 (structured logging) | Yes | T2.10 | metrics gap → O1 |
| FR-042 (SSE) | Yes | T2.3, T2.4, T2.7 | |
| FR-043 (output sanitization) | Yes | T2.13b, T2.11 | |
| FR-044 (SSE authn) | Yes | T2.3 | |
| FR-045 (auto-poster) | Yes | T2.17, T2.18, T3.2? (publish hook) | $149 SKU headline covered |
| FR-046 (QuestionPool) | Yes (post-Wave-1) | T2.19 | gated on undrepay `INTEGRATION.md` |

All user stories US1–US8 map to tasks; US9/US10 deferred by design; US11 (sync-fork) → T0.3.

## Constitution Alignment Issues

- **VI (Cross-AI Review Gate)** — informational, not an artifact defect: all 4 existing external reviews (claude/grok/opencode/zcode) predate the 2026-11-18 fix-pass and carry non-PASS verdicts; the gate requires ≥2 external PASS on the **current** artifacts before `/speckit.implement`.
- **VII (Artifact Versioning)** — see C1 (fix-pass uncommitted/untagged).
- **IX (Two-Phase Flow)** — conforms: branch renamed to `specs/001-init-from-payload` (fix F17).

## Commercial / Business Plan Alignment

- Plan files loaded: `undreplans/docs/projects/undreposts/undreposts-business-plan.md` (v1.0), `undreposts-demand.md`.
- Focus/hard laws checked: FM-01 (no B2B social network — compliant), FM-02 (adapter isolation — in FR-045/T2.17), $149 SKU composition (auto-poster T2.17 + newsletter T2.6/T3.5 — covered), kill criteria (business-layer, n/a).
- Findings: no commercial drift; one LOW alias note (H1).

## Unmapped Tasks

None. T4.1 (perf), T4.2 (security review), T3.2b (list optimization) map to NFR/cross-cutting concerns.

## Metrics

- Total Requirements: 25 FR keys
- Total Tasks: 45 (39 Wave-1 primary; 5 wave-2-backlog; 1 post-Wave-1; verified by grep)
- Coverage % (requirements with ≥1 task): 96% (24/25; FR-032 out of scope by design — 100% of in-scope)
- Ambiguity count: 0
- Duplication count: 1 (D1, LOW)
- CRITICAL count: 0
- HIGH count: 1
- MEDIUM count: 3
- LOW count: 6

## VERDICT

```yaml
verdict: MEDIUM
override_reason: null
reviewer: analyze
reviewed_at: 2026-11-18T21:20:00+04:00
commit: c45fa2ba466c72670b3032393d6af265f8d0c0cd (working tree ahead — uncommitted fix-pass 2026-11-18)
critical_count: 0
high_count: 1
medium_count: 3
low_count: 6
```
