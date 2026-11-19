import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/roles'

/**
 * Auction presentation reference — WAVE-2 BACKLOG only (T2.13/T2.14 are
 * `status: wave-2-backlog`; the auction engine lives in undrlla). Collection
 * exists as schema-level placeholder per data-model.md; do NOT implement
 * bidding against it in Wave-1.
 */
export const AuctionRef: CollectionConfig = {
  slug: 'auctions',
  access: {
    create: isAdmin,
    delete: isAdmin,
    read: () => true,
    update: isAdmin,
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
      required: true,
    },
    {
      name: 'undrllaRef',
      type: 'text',
      admin: {
        description: 'Pointer to undrlla auction entity.',
      },
      required: true,
    },
    {
      name: 'presentationConfig',
      type: 'group',
      fields: [
        {
          name: 'showCountdown',
          type: 'checkbox',
        },
        {
          name: 'theme',
          type: 'select',
          options: ['default', 'compact'],
        },
      ],
    },
  ],
  indexes: [
    {
      fields: ['post'],
    },
  ],
}
