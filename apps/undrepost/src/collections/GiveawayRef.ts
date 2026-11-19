import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/roles'

/**
 * Giveaway reference (Wave-1: content-only prizes; product/paid winner
 * delegation to undrlla is `wave-2-backlog` — T2.12b).
 */
export const GiveawayRef: CollectionConfig = {
  slug: 'giveaways',
  access: {
    create: ({ req }) => Boolean(req.user),
    delete: isAdmin,
    read: () => true,
    update: isAdmin,
  },
  admin: {
    useAsTitle: 'post',
  },
  fields: [
    {
      name: 'post',
      type: 'relationship',
      index: true,
      relationTo: 'posts',
      required: true,
    },
    {
      name: 'prizeType',
      type: 'select',
      admin: {
        description:
          'content → undrepost-local winner selection; product → undrlla-delegated (Wave-2).',
      },
      options: ['content', 'product'],
      required: true,
    },
    {
      name: 'undrllaRef',
      type: 'text',
      admin: {
        description: 'Pointer to undrlla giveaway entity (product/paid prizes only).',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      index: true,
      options: ['active', 'closed'],
    },
    {
      name: 'winner',
      type: 'relationship',
      admin: {
        description: 'Set on close for content-only prizes (random from unique entrants).',
      },
      relationTo: 'members',
    },
    {
      name: 'closesAt',
      type: 'date',
    },
  ],
  indexes: [
    {
      fields: ['post'],
    },
    {
      fields: ['status'],
    },
  ],
}
