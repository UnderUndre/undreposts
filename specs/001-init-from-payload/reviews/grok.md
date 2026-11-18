# SpecKit Review: 001-init-from-payload

**Reviewer**: grok
**Reviewed at**: 2026-07-23T10:06:54Z
**Commit**: e7136b0abb2b7f8758ee31fb119cd85158371e1d
**Artifacts reviewed**: spec.md (and related clarify notes in-file); ECOSYSTEM.md; undrlla Directus rebase

## Summary

Solid content/social product thinking on Payload fork, good commerce boundary (no money-state). **CRITICAL: identity foundation is obsolete** — assumes undrlla Better-Auth/Medusa IdP; undrlla is Directus; ECOSYSTEM locks Directus as IdP. Auction dependency on undrlla contract does not exist in current undrlla specs.

## Findings

| ID | Severity | Area | Finding | Recommendation |
|---|---|---|---|---|
| F1 | CRITICAL | Consistency / IdP | Clarifications: undrlla Better-Auth IdP, Members mirror from sub. undrlla is **Directus**; ECOSYSTEM: Directus users IdP. Spec cannot implement as written. | Rewrite Session clarifications + FRs for Directus JWT/session; Member mirror from Directus user id. |
| F2 | CRITICAL | Cross-repo | Auction/giveaway engine "in undrlla" — **no auction FR** in undrlla 001 Directus specs (legacy Medusa-era). | Defer auction stories or add undrlla auction feature spec first. |
| F3 | HIGH | Security | SSE real-time from Wave 1 — connection limits mentioned; **auth on SSE** and fan-out cost need hardening. | Cookie/JWT on SSE; per-user connection caps; backpressure. |
| F4 | HIGH | Scope | Wave-1 includes reactions, emoji, polls, newsletter, auction — large for rewrite. | Hard P0: posts, auth, comments, media; rest later. |
| F5 | MEDIUM | Failure modes | undrlla unreachable → auction read-only OK; **IdP unreachable → total login outage** not mitigated. | Cached session; degraded public-read mode. |
| F6 | MEDIUM | Stakeholder | Single-tenant per blog deploy OK; undevops deploy path for blogs unspecified. | Add undevops app template for undrepost. |
| F7 | LOW | Artifacts | plan/tasks may exist under other names — if missing, CRITICAL for implement. | Ensure full SpecKit set before implement. |

## Alternative approaches considered

- Keep underblog Next+Prisma (reject if Payload is strategic).
- undrlla hosts blog collections (blurs bounded context).

## VERDICT

```yaml
verdict: CRITICAL
reviewer: grok
reviewed_at: 2026-07-23T10:06:54Z
commit: e7136b0abb2b7f8758ee31fb119cd85158371e1d
critical_count: 2
high_count: 2
medium_count: 2
low_count: 1
```
