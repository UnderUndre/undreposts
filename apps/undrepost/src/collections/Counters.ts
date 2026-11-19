import type { CollectionConfig } from 'payload'

/**
 * Materialized async counters (T2.4): per-post reaction counts and per-poll
 * option counts. Updated on write hooks (async-ish, never blocking reads of
 * source entities) and corrected by the reconcile job (T2.4b). Counters are
 * NEVER authoritative (data-model.md).
 */
export const Counters: CollectionConfig = {
  slug: 'counters',
  access: {
    // Only reachable through server-side Local API calls (overrideAccess: true)
    // and the public read used by the frontend interactions widget.
    create: () => false,
    delete: () => false,
    read: () => true,
    update: () => false,
  },
  admin: {
    hidden: true,
  },
  fields: [
    {
      name: 'post',
      type: 'relationship',
      index: true,
      relationTo: 'posts',
    },
    {
      name: 'poll',
      type: 'relationship',
      index: true,
      relationTo: 'polls',
    },
    {
      name: 'key',
      type: 'text',
      admin: {
        description: 'emojiRef for post counters, optionId for poll counters.',
      },
      required: true,
    },
    {
      name: 'count',
      type: 'number',
      defaultValue: 0,
    },
  ],
  indexes: [
    {
      fields: ['post', 'key'],
      unique: true,
    },
    {
      fields: ['poll', 'key'],
      unique: true,
    },
  ],
}
