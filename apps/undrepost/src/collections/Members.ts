import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/roles'
import { undrllaSessionStrategy } from '../auth/undrllaSessionStrategy'

/**
 * Auth seam (review F4 / FR-013):
 * - AUTH_STRATEGY=directus   → ecosystem mode: opaque `__Secure-undrepost-session` cookie validated
 *   by the custom `undrlla-session` AuthStrategy; local email/password strategy disabled
 *   (FR-014 — no locally-minted credentials for ecosystem instances).
 * - AUTH_STRATEGY=payload-local → standalone mode (local dev, $149 Boilerplate SKU):
 *   Payload-native email/password auth on Members.
 */
const authMode =
  process.env.AUTH_STRATEGY === 'directus'
    ? {
        disableLocalStrategy: true,
        strategies: [undrllaSessionStrategy],
      }
    : true

export const Members: CollectionConfig = {
  slug: 'members',
  access: {
    // Auth collections default to authenticated-only reads, which breaks public
    // author population (Posts.author → members). Public reads are required for
    // authorship attribution (displayName/avatar/bio); PII fields (sub, email,
    // roles) are restricted via field-level access below.
    read: () => true,
    // Roles are admin-domain state: only admins may grant/revoke.
    delete: isAdmin,
    update: ({ req }) => Boolean(req.user),
  },
  admin: {
    description:
      'Mirror of undrlla IdP members (spec 001 data-model). Roles are NEVER claim-derived — resolved server-side from the sub allowlist (contract rules).',
    useAsTitle: 'displayName',
  },
  auth: authMode,
  fields: [
    {
      // Overrides the implicit auth-collection email field: PII — never served
      // to anonymous requests (contract: email is PII, redacted from logs).
      name: 'email',
      type: 'email',
      access: {
        read: ({ req }) => Boolean(req.user),
      },
    },
    {
      name: 'sub',
      type: 'text',
      access: {
        // PII: identity key — never served to anonymous requests.
        read: ({ req }) => Boolean(req.user),
      },
      admin: {
        description: 'undrlla subject — authoritative identity key (UNIQUE, DB-enforced).',
        readOnly: true,
      },
      index: true,
      label: 'IdP Subject (sub)',
      unique: true,
    },
    {
      name: 'displayName',
      type: 'text',
    },
    {
      name: 'roles',
      type: 'select',
      access: {
        create: isAdmin,
        // Roles are authorization state — never exposed to anonymous requests.
        read: ({ req }) => Boolean(req.user),
        update: isAdmin,
      },
      defaultValue: ['member'],
      hasMany: true,
      options: ['admin', 'member'],
    },
    {
      name: 'profile',
      type: 'group',
      fields: [
        {
          name: 'avatarUrl',
          type: 'text',
        },
        {
          name: 'bio',
          type: 'textarea',
        },
      ],
    },
    {
      name: 'syncedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
      label: 'Last IdP re-sync',
    },
    {
      name: 'tombstonedAt',
      type: 'date',
      admin: {
        description:
          'Set by the daily sweep (T2.20) when the IdP deletes the upstream user. Record retained for FK integrity; displayName → "[deleted]".',
        position: 'sidebar',
        readOnly: true,
      },
      label: 'Tombstoned at',
    },
  ],
}
