# research.md — 001-init-from-payload (spike governance, analyze K1 fix 2026-11-19)

Two exploratory spikes are on the Wave-1 critical path. Per the spike-governance lens (ISO/IEC/IEEE 12207), each has explicit verification metrics and a mandatory Spike Disposal Path. **Raw spike code MUST NOT reach the app layer unreviewed** — implementation tasks (T1.3/T1.5) write production code fresh, using spike learnings only.

## Spike S1 (T0.4) — IdP contract conformance

**Question**: does a real undrlla Directus staging token pass the undrepost 5-check validator (members.contract.md), i.e. is RS256 + JWKS + canonical-aud (§3.2/§3.3 incl. `undrepost`) actually available?

**Verification metrics** (all must hold to pass the spike):

1. Staging-minted access token validates: signature (JWKS), `iss`, `aud ⊇ undrepost`, `exp` (+±60s skew), non-empty `sub` — 5/5 checks green.
2. JWKS fetch p95 < 500ms from the undrepost runtime (cold + warm).
3. Token `alg` = RS256 (HS256-only = spike FAILS → escalate to undrlla: extension needed before T1.3).
4. Refresh flow per FR-SSO-02 returns a rotated opaque refresh token.

**Disposal path**: throwaway. The validator implementation is re-written for production inside T1.3/T1.5 with review; spike scripts are deleted or demoted to `test/fixtures` (mock IdP responses), never merged into `apps/undrepost/` runtime code. Decision recorded as a dated note in this file (PASS/FAIL + metrics).

## Spike S2 (T1.5) — Payload v4-beta custom auth strategy + session bridge

**Question**: does Payload v4.0.0-beta.0 support a custom authentication strategy (or a viable middleware-guard fallback) that (a) accepts the opaque `__Secure-undrepost-session` cookie for the Admin UI and (b) keeps `auth: true` collection flows working?

**Verification metrics**:

1. Strategy API exists and accepts a session-cookie lookup → admin login completes end-to-end (yes/no — a "no" triggers the documented fallback, see below).
2. Session validation p95 < 5ms (in-memory store, warm).
3. Fallback benchmark (if strategy API absent): middleware guard on `/admin` — admin panel loads < 200ms p95 with the guard.
4. Escape-hatch check: if either path requires editing forked core packages → FR-001 escape-hatch ladder is invoked and the patch point is documented in T0.3's rebase/patch notes (this is the fork-discipline stress test, review F4).

**Disposal path**: throwaway. Spike branch/scratch code is discarded; the production session bridge and admin strategy are written fresh in T1.5 follow-through under normal PR review. Spike outcome (strategy vs fallback) is recorded here as a dated note before T3.1 (admin customizations) starts.

## Outcome log

- 2026-11-19: file created (analyze K1). Both spikes pending execution — outcomes appended as `S1: PASS/FAIL <metrics>` / `S2: STRATEGY|FALLBACK <metrics>` dated lines below.
