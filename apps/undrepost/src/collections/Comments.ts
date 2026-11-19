import type { CollectionConfig } from 'payload'

import { isAdminOrAuthor } from '../access/roles'

export const Comments: CollectionConfig = {
  slug: 'comments',
  access: {
    // Soft-deleted comments stay hidden from the public (FR-011).
    read: ({ req }) =>
      req.user
        ? true
        : {
            deletedAt: {
              exists: false,
            },
          },
    // Member-only commenting (FR-011 gating) — no anonymous authors.
    create: ({ req }) => Boolean(req.user),
    delete: isAdminOrAuthor,
    update: isAdminOrAuthor,
  },
  admin: {
    defaultSort: '-createdAt',
    useAsTitle: 'body',
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
      name: 'author',
      type: 'relationship',
      index: true,
      relationTo: 'members',
      required: true,
    },
    {
      name: 'body',
      type: 'textarea',
      required: true,
    },
    {
      name: 'deletedAt',
      type: 'date',
      admin: {
        description: 'Soft-delete tombstone (FR-011) — record retained, public reads filtered.',
        position: 'sidebar',
      },
    },
  ],
  indexes: [
    {
      fields: ['post'],
    },
    {
      fields: ['createdAt'],
    },
  ],
}
