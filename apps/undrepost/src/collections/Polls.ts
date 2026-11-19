import type { CollectionConfig } from 'payload'

import { isAdminOrAuthor } from '../access/roles'

export const Polls: CollectionConfig = {
  slug: 'polls',
  access: {
    create: ({ req }) => Boolean(req.user),
    delete: isAdminOrAuthor,
    read: () => true,
    update: isAdminOrAuthor,
  },
  admin: {
    useAsTitle: 'question',
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
      name: 'question',
      type: 'text',
      required: true,
    },
    {
      name: 'options',
      type: 'array',
      fields: [
        {
          name: 'optionId',
          type: 'text',
          admin: {
            description: 'Stable id referenced by PollVote.optionId.',
          },
          required: true,
        },
        {
          name: 'label',
          type: 'text',
          required: true,
        },
      ],
      minRows: 2,
      required: true,
    },
    {
      name: 'expiresAt',
      type: 'date',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'status',
      type: 'select',
      admin: {
        position: 'sidebar',
      },
      defaultValue: 'active',
      options: ['active', 'closed'],
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
