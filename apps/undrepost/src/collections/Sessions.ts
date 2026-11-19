import type { CollectionConfig } from 'payload'

/**
 * Opaque server-side session store (members.contract.md §Session Bridge).
 * 256-bit random token → Member. TTL: 24h absolute / 2h idle (enforced in
 * src/auth/undrllaSessionStrategy.ts). No JWT minting (FR-014).
 */
export const Sessions: CollectionConfig = {
  slug: 'sessions',
  access: {
    // Store is only reachable through server-side Local API calls
    // (overrideAccess: true) — no direct REST/GraphQL surface.
    create: () => false,
    delete: () => false,
    read: () => false,
    update: () => false,
  },
  admin: {
    hidden: true,
  },
  fields: [
    {
      name: 'token',
      type: 'text',
      admin: {
        description: '256-bit opaque session id (base64url). NEVER a JWT.',
      },
      index: true,
      required: true,
      unique: true,
    },
    {
      name: 'member',
      type: 'relationship',
      index: true,
      relationTo: 'members',
      required: true,
    },
    {
      name: 'expiresAt',
      type: 'date',
      admin: {
        description: '24h absolute TTL.',
      },
      required: true,
    },
    {
      name: 'lastSeenAt',
      type: 'date',
      admin: {
        description: '2h sliding idle TTL — refreshed on authenticated hits.',
      },
      required: true,
    },
  ],
  indexes: [
    {
      fields: ['token'],
      unique: true,
    },
    {
      fields: ['member'],
    },
  ],
}
