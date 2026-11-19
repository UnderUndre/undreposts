import type { CollectionConfig } from 'payload'

/**
 * FR-045 Wave-1: outbound social syndication journal. Retry-safe dedup:
 * exactly one `sent` per (post, channel). External API failures MUST NOT fail
 * local publication (business-plan FM-02) — adapters write here, never throw up.
 */
export const SyndicationLog: CollectionConfig = {
  slug: 'syndication-log',
  access: {
    create: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  admin: {
    defaultSort: '-createdAt',
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
      name: 'channel',
      type: 'select',
      index: true,
      options: ['telegram', 'x', 'linkedin', 'habr'],
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      index: true,
      options: ['pending', 'sent', 'failed'],
    },
    {
      name: 'externalRef',
      type: 'text',
      admin: {
        description: 'Platform message/post id on success.',
      },
    },
    {
      name: 'error',
      type: 'textarea',
    },
  ],
  indexes: [
    {
      fields: ['post', 'channel'],
    },
    {
      fields: ['status'],
    },
  ],
}
