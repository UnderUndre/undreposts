# 2026-11-19 — ZCode — undrepost 001-init-from-payload: sync + implement + browser QA

## Done

1. **Spec gate close-out**
   - antigravity.md committed (`dfafe05f10`), base pin re-written beta.0 → upstream main `7a41086106` = 4.0.0-beta.10 (850 commits), spec assumptions re-verified on beta.10 (auth seam types.ts:269/348, `apps/` still absent upstream).
   - Review F1–F4 folded into tasks.md annotations; owner override of Principle VI logged in `reviews/_gate-override.md` (`8412c7a9f2`); specs branch pushed.

2. **Fork sync (T0.1)**
   - fork `main` merged upstream/main (true merge — fork main had clai-helpers commits, not ff): `34b29654b0`.
   - Conflicts resolved: `.claude/skills/*` → `.agents/skills/` (upstream rename), CLAUDE.md kept (helpers mirror), pnpm-lock took upstream + re-install.
   - specs branch merged into main (`13faf98c1b`); implement branch `implement/001-init-from-payload` created, main + branch pushed to origin.

3. **Implementation (`e00d49fac0` + `061f569067`)**
   - `apps/undrepost` new pnpm workspace (`apps/*` in pnpm-workspace.yaml — F7 patch point).
   - 14 collections per data-model.md (members/sessions/media/posts/comments/reactions/custom-emoji/polls/poll-votes/newsletter-subscribers/syndication-log/question-pool/giveaways/auctions-wave2-placeholder).
   - Auth: `AUTH_STRATEGY=directus|payload-local` seam (F4/FR-013); opaque session store (24h/2h); `undrlla-session` AuthStrategy; 5-check IdP JWT validation (jose, JWKS 1h + LKG); JIT upsert (roles from ADMIN_ALLOWLIST only, PII-redacted audit, UNIQUE(sub) race retry); endpoints `/api/internal/jit-provision`, `/api/auth/login|logout`.
   - Frontend: landing, /blog, /blog/[slug] (canonical + OG via generateMetadata), /blog/rss.xml (F3).
   - root package.json: dropped `underundre-clai-helpers` (unpublished on npm 2026-08-13) + `@underundre/undesign` (zero imports) — unblocked install.

4. **Browser QA (live, IAB)**
   - Admin: create-first-user → login OK; dashboard shows all collections (Sessions/Auctions hidden as designed).
   - Post CRUD via admin UI: lexical content, author rel, status=published → 201.
   - Public: /blog list (author populated), /blog/hello-undrepost 200 with `<title>`, `rel=canonical`, `og:title`; /blog/rss.xml has item.
   - Contracts: JIT without token → 401 missing_bearer_token; login without token → 400 missing_token.
   - PII: anonymous API shows author displayName only; email/roles/sub absent.

## Key decisions / trade-offs

- **Posts.meta split**: plugin-seo hard-codes its group as `meta` (packages/plugin-seo/src/index.ts:54) → data-model's meta(tags/excerpts) split into top-level `tags`/`excerpt`; annotated in Posts.ts + data-model note for T4.3.
- **webpack dev**: Turbopack dev can't resolve relative `.js→.ts` across pnpm junctions (Windows); `next dev --webpack` (upstream's own `--no-turbo` fallback path); `dev:turbo` kept; turbopack.root = repo root + app-local no-op instrumentation shadowing upstream root Sentry file.
- **Members public read**: auth collections default to authenticated-only reads → author population broken; fixed with collection read:() => true + field-level PII guards (email/sub/roles authenticated-only).
- **Dead deps removed**: underundre-clai-helpers unpublished 2026-08-13 — fork install was bricked by it.

## Artifacts

- Branch `implement/001-init-from-payload` @ `061f569067` (pushed); `main` @ beta.10 merge `13faf98c1b` (pushed).
- `apps/undrepost/docs/patch-points.md` — T0.3 ledger (workspace wiring, fork-only paths, rebase playbook).
- Dev server: `pnpm --filter undrepost dev` (webpack) on :3000; local DB = postgres in docker `undreseller_db` / db `undrepost`.

## Follow-ups (not done tonight)

- T2.8 S3 storage fixture + CI (Media uses local disk upload for MVP).
- SSE service (T2.3), counters (T2.4), newsletter flows (T2.6), syndication adapters (T2.17) — P2 lane.
- Directus-mode login flow untested (no IdP locally) — code path implemented, needs T0.4 staging spike.
- Occasional dev-server SIGTERM (exit 1 without trace) observed twice — root cause unknown, watchdog candidate.
