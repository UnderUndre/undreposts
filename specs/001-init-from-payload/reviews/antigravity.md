# SpecKit Review: 001-init-from-payload

**Reviewer**: antigravity
**Reviewed at**: 2026-11-19T03:35:00+04:00
**Commit**: 15cab3adc935ad61734fec7172b4f2f6873f17eb
**Artifacts reviewed**: spec.md, plan.md, tasks.md, data-model.md, contracts/members.contract.md, research.md, quickstart.md, reviews/analyze.md, reviews/{claude,grok,opencode,zcode}.md, .specify/memory/constitution.md (v1.5.0), undreplans/docs/projects/undreposts/{undreposts-business-plan.md,undreposts-demand.md}, undrlla/specs/003-sso-jwt-contract/005-sso-jwt-contract.md, packages/payload/src/auth/{types.ts,executeAuthStrategies.ts}

## Summary

Following the `f1a8041222` remediation pass and `15cab3adc9` re-analyze (`PASS 0/0/0/0`), the `001-init-from-payload` specification set is architecturally sound, internally consistent, and ready for implementation. All prior CRITICAL and HIGH blockers from earlier waves — including the Wave-1 auction release-gate contradiction, the cross-repo `aud: [..., "undrepost"]` interlock with `undrlla` spec 005 (§3.2/§3.3), the server-side `sub`-only admin allowlist, the opaque session bridge (`__Secure-undrepost-session`), `FR-045` Wave-1 auto-poster tasking (`T2.17`/`SyndicationLog`), `FR-046` money-state isolation (`QuestionPool` status mirror only), and ISO 12207 spike disposal governance (`research.md`) — are verifiably closed. Inspection of the actual `payload-monorepo` v4.0.0-beta.0 source tree (`packages/payload/src/auth/types.ts:196-199,231-240`) also confirms first-class support for `disableLocalStrategy: true` with custom `AuthStrategy` functions, de-risking Spike S2 (`T1.5`). Remaining findings are 4 MEDIUM and 4 LOW refinements that can be folded directly into task execution without blocking `/speckit.implement`.

## Findings

| ID | Severity | Area | Finding | Recommendation |
| --- | --- | --- | --- | --- |
| F1 | MEDIUM | Task Graph Hygiene (Lens A) | `tasks.md:96` (`T2.8 → T1.2 + T2.1 + T2.11`) and `tasks.md:107` (`T2.11 → T2.2 + T2.8`) form a 2-node cycle (`T2.8 ↔ T2.11`). Since `T2.8` configures the S3 storage adapter and `T2.11` implements `CustomEmoji` uploads on top of S3, `T2.8` is the prerequisite for `T2.11`, not the reverse. | Remove `+ T2.8` from `tasks.md:107` so the edge reads `- T2.11 → T2.2`. |
| F2 | MEDIUM | Failure Modes / Tombstone Sweep (Lens C/D) | `T2.20` (`plan.md:36`, `data-model.md:141`, `contracts/members.contract.md:53`) defines a daily sweep comparing local `Members.sub` records against IdP active users to apply `[deleted]` tombstones, but omits (a) how `undrepost` authenticates the batch lookup against Directus (`id.undrlla.network`) and (b) a **fail-closed outage guard**. If Directus returns 5xx, a partial page, or an empty result during an IdP hiccup, a naive set-difference sweep would mass-tombstone all active authors. | In `T2.20`, require a read-only Directus M2M token (`IDP_M2M_TOKEN` scoped to the bound `tenant_id`) or signed deletion webhook, and enforce a sanity threshold (abort sweep on HTTP error, non-200 status, or if $>5\%$ of active members would be tombstoned in a single run without manual flag). |
| F3 | MEDIUM | Commercial / SEO Guardrails (Lens J) | `undreposts-business-plan.md` §2.9 ("Забор Честертона: RSS, OpenGraph, custom `sitemap.xml`") and §6 `FM-03` ("Принудительная генерация канонических ссылок `rel=\"canonical\"`") make domain SEO retention a primary commercial invariant. `data-model.md:28` lists only `meta (object) — tags, excerpts`, and `T1.2`/`T3.2`/`T2.17` do not explicitly mention `rel="canonical"`, OpenGraph metadata, or RSS generation. | Wire `@payloadcms/plugin-seo` (already present in the monorepo at `packages/plugin-seo`) into `Posts` (`T1.2`), render `<link rel="canonical">` + OG tags + `/blog/rss.xml` in `T3.2`, and append the canonical post URL to outbound Telegram/X syndication payloads in `T2.17`. |
| F4 | MEDIUM | Commercial Packaging / Pluggable Auth Seam (Lens G/J) | `FR-005`/`FR-014` lock authentication to `undrlla` Directus IdP, while `undreposts-business-plan.md` §4 sells the self-hosted `$149 Headless B2B Content Hub Boilerplate` to external B2B companies that do not run an `undrlla` Directus IdP cluster. Without an explicit toggle, the FOSS/ ecosystem repo cannot be packaged into the standalone $149 SKU without code surgery. | Use the `FR-013` pluggable-adapter requirement during `T1.5` to expose an env switch (`AUTH_STRATEGY=directus|payload-local`): ecosystem instances enforce `directus` (`disableLocalStrategy: true`), while standalone boilerplate builds can enable Payload's native local auth on `Members` via configuration alone. |
| F5 | LOW | Data Model Completeness (Lens A) | `data-model.md` lists 12 collections but omits: (1) the `Media` upload collection (`spec.md:252`, `FR-012`), (2) `Posts.coverImage` relation to `Media` (`spec.md:212`, `FR-010`), (3) the backing store note for the opaque session record (`contracts/members.contract.md:57` — Redis via `T2.7` or Payload session table), and (4) the unique-entrant storage shape for content-only giveaways (`T2.12a` / `GiveawayRef`). | Document `Media`, `Posts.coverImage`, session storage backing (Redis key `sess:<id>` with 24h TTL / 2h sliding idle), and `GiveawayEntry(giveaway, member)` in `data-model.md` during Phase 1/2 implementation. |
| F6 | LOW | Security / Session Cookie Attributes (Lens E) | `contracts/members.contract.md:57` specifies the `HttpOnly` `__Secure-undrepost-session` cookie (24h absolute / 2h idle) but does not explicitly state `SameSite` or CSRF protection for state-changing endpoints (`POST /api/internal/jit-provision` uses Bearer JWT, whereas browser comment/reaction/poll mutations use the session cookie). | Set `SameSite=Lax; Secure; HttpOnly; Path=/` on `__Secure-undrepost-session` (matching `undrlla` 005 §4.1) and verify `Origin`/`Referer` against the configured site origin on cookie-authenticated `POST`/`PATCH`/`DELETE` routes in `T1.5`/`T2.9`. |
| F7 | LOW | Monorepo Workspace Wiring (Lens B) | `plan.md:54` pins the app at `apps/undrepost/` ("upstream payload-monorepo has no `apps/` dir"). In the current fork root, `pnpm-workspace.yaml:1-7` and `package.json:6-9` only include `packages/*`, `tools/*`, `test`, and `templates/*`. Adding `apps/undrepost/` requires a 1-line addition (`'apps/*'`) in both root files. | Record `pnpm-workspace.yaml` and root `package.json#workspaces` in `T0.3`'s rebase/patch-point documentation so Sync-fork merges keep `'apps/*'` intact. |
| F8 | LOW | Stale Auxiliary Wording (Lens H) | Three minor text leftovers from pre-hygiene revisions remain: (1) `spec.md:320` says "but a full GA release is gated on undrlla readiness" right below `spec.md:315-316` which explicitly scopes that gate to Wave-2 auctions only; (2) `quickstart.md:42` says "assumes the Payload app is configured at the repo root" instead of `apps/undrepost/`; (3) `reviews/context-for-review.md:6,25-28` still instructs reviewers to check that auctions are blocking. | Clean up the three phrases during `T4.3` documentation pass (or as a minor drift note). |

## Commercial / business plan notes

- Plans loaded: `undreplans/docs/projects/undreposts/undreposts-business-plan.md` (v1.0.1, 2026-11-19) and `undreplans/docs/projects/undreposts/undreposts-demand.md`.
- Focus laws / SKU floors checked:
  - **FM-01 (No isolated B2B social network)**: Respected — auctions (`FR-030`) and paid giveaways (`FR-031`) are deferred to Wave-2; DMs are out of scope; focus is on the sovereign headless blog + multi-channel distribution.
  - **FM-02 (Social API resilience)**: Respected — `FR-045` and `T2.17` isolate social adapters behind a common interface with `SyndicationLog` deduplication/retry and guarantee that external API failures never fail local post publication.
  - **FM-03 (SEO ownership / canonical links)**: Addressed via recommendation **F3** above (explicitly wire `@payloadcms/plugin-seo` + RSS + canonical backlink in syndicated posts).
  - **$149 Boilerplate SKU (`Next.js 15 /blog + Payload v4 + TG/X Auto-Poster + Newsletter`)**: All headline components are in Wave-1 (`T1.2`, `T2.6`/`T3.5`, `T2.17`, `T2.18`). Recommendation **F4** ensures the `FR-013` auth-adapter seam supports standalone non-ecosystem buyers out of the box.
- Drift: None blocking (see MEDIUM findings F3/F4 for implementation guardrails).

## Alternative approaches considered

1. **Payload v4 Native Custom `AuthStrategy` vs Next.js Middleware Guard for Spike S2 (`T1.5`)**:
   Inspection of `packages/payload/src/auth/types.ts:196-199,231-240` and `packages/payload/src/auth/executeAuthStrategies.ts:5-38` in the forked repository confirms that Payload v4.0.0-beta.0 natively supports `auth: { disableLocalStrategy: true, strategies: [{ name: 'undrlla-session', authenticate }] }` on the `Members` collection (`admin.user = 'members'`). Using Payload's built-in `AuthStrategy` populates `req.user` uniformly across REST, GraphQL, Local API, and the Admin UI with zero core package edits (`SC-003` preserved), making the middleware fallback unnecessary unless a beta bug is encountered in `T1.5`.
2. **Env-Selectable Auth Strategy (`AUTH_STRATEGY=directus|payload-local`) under `FR-013` (F4)**:
   Because Payload's `disableLocalStrategy` is a boolean config property on the `Members` collection, toggling between Directus OIDC session-bridge (`disableLocalStrategy: true`) for Undrlla ecosystem deployments and Payload-native authentication (`disableLocalStrategy: false`) for external $149 Boilerplate buyers is a ~15-line config seam in `apps/undrepost/src/collections/Members.ts`.

## VERDICT

```yaml
verdict: PASS
reviewer: antigravity
reviewed_at: 2026-11-19T03:35:00+04:00
commit: 15cab3adc935ad61734fec7172b4f2f6873f17eb
critical_count: 0
high_count: 0
medium_count: 4
low_count: 4
```
