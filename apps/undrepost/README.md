# apps/undrepost

Sovereign headless blog + social distribution app on Payload (spec
`001-init-from-payload`). Lives inside the payload monorepo fork as a new
top-level pnpm workspace (`apps/*`).

## Dev quickstart

```bash
# from repo root (or apps/undrepost)
pnpm install
# local Postgres (owner machine: running docker container `undreseller_db`)
# DATABASE_URI=postgres://postgres:postgres@127.0.0.1:5432/undrepost (.env)
pnpm --filter undrepost generate:importmap
pnpm --filter undrepost generate:types
pnpm --filter undrepost dev
```

- App: http://localhost:3000 (landing + /blog + /blog/rss.xml)
- Admin: http://localhost:3000/admin

## Auth seam (FR-013 / review F4)

`AUTH_STRATEGY` in `.env`:

| Value           | Mode                                                                        | Use                                        |
| --------------- | --------------------------------------------------------------------------- | ------------------------------------------ |
| `payload-local` | Payload-native email/password on Members                                    | local dev, standalone $149 Boilerplate SKU |
| `directus`      | Opaque `__Secure-undrepost-session` cookie + `undrlla-session` AuthStrategy | undrlla ecosystem deployments              |

Ecosystem login flow: `POST /api/auth/login { token: <IdP JWT> }` → 5-check
validation (signature/iss/aud/sub/exp + tenant) → JIT upsert → opaque session.
Internal provisioning hook: `POST /api/internal/jit-provision` (Bearer JWT,
claims from token only — contract `members.contract.md`).

## Patch points (T0.3)

See [docs/patch-points.md](docs/patch-points.md) — rebase/patch-point ledger
for Sync-fork merges (what we add on top of upstream, and where).
