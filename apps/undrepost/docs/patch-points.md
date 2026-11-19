# Patch points (T0.3) — undrepost fork vs upstream payload

Escape-hatch ladder ledger: every deviation from upstream the fork carries,
with the exact files, so Sync-fork merges keep them intact. Base pin: upstream
main `7a41086106` = **4.0.0-beta.10** (2026-11-19; supersedes beta.0 spec pin).

## Workspace wiring (review F7)

| File                  | Patch                                                                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm-workspace.yaml` | added `'apps/*'` to `packages:` — upstream on beta.10 lists explicit templates (`templates/blank`, `blank-tanstack`, `website`, `ecommerce`), NOT the beta.0 `templates/*` glob. Keep both: upstream's explicit list + our `apps/*`. |
| root `package.json`   | no change needed (workspaces via pnpm-workspace.yaml only).                                                                                                                                                                          |

## Fork-only paths (zero upstream collision)

| Path                                                                                          | Content                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/undrepost/`                                                                             | the blog/social app (collections, auth bridge, frontend). Upstream has singular `app/` + `app-tanstack/` dev apps — **not** `apps/` — collision surface zero by construction.        |
| `specs/`                                                                                      | SpecKit artifacts (001-init-from-payload and future specs).                                                                                                                          |
| `helpers-lock.json`, `.codex/`, `.cursor/`, `.gemini/`, `.agents/skills/` (fork-added skills) | clai-helpers transpilation mirrors. NOTE: upstream renamed `.claude/skills/` → `.agents/skills/` in the beta.10 window; fork skill files were relocated there during the sync merge. |
| `CLAUDE.md` (fork/helpers-managed copy)                                                       | upstream deleted its CLAUDE.md in favor of `AGENTS.md`; fork keeps its helpers-managed mirror. Re-verify on every sync.                                                              |

## App-layer deviations (do not patch upstream to fit the app)

1. **`meta` field group**: data-model.md lists `Posts.meta` (tags, excerpts) —
   `@payloadcms/plugin-seo` hard-codes its SEO group under `meta`
   (`packages/plugin-seo/src/index.ts:54`), so Posts carries top-level
   `tags`/`excerpt` instead. Recorded in `Posts.ts` comment; data-model.md gets
   the annotation in the T4.3 docs pass.
2. **Members auth seam**: `AUTH_STRATEGY=directus\|payload-local`
   (`apps/undrepost/src/collections/Members.ts`) — upstream never touched.
3. **Custom endpoints**: `/api/internal/jit-provision`, `/api/auth/login`,
   `/api/auth/logout` (`apps/undrepost/src/endpoints/`).

## Rebase/merge playbook (Sync-fork discipline)

1. `git fetch upstream && git merge upstream/main` on `main`.
2. Expected conflicts: `pnpm-workspace.yaml` (keep `'apps/*'` + upstream list),
   `pnpm-lock.yaml` (take upstream, re-run `pnpm install`), `CLAUDE.md`
   (modify/delete — keep fork's helpers mirror), `.claude/*` rename detection
   (accept relocation to `.agents/`).
3. Re-run `pnpm install`, `pnpm --filter undrepost generate:types` (beta API
   churn), app smoke test before merging forward.
4. Re-verify spec assumptions that touch payload internals (e.g. auth strategy
   API) — beta churn can move line numbers; re-check the API, not the lines.
