import type { CollectionConfig } from 'payload'

export const PollVote: CollectionConfig = {
  slug: 'poll-votes',
  access: {
    read: () => true,
    // FR-022: one vote per member per poll — create-only, no edits.
    create: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
    update: () => false,
  },
  admin: {
    defaultSort: '-createdAt',
  },
  fields: [
    {
      name: 'poll',
      type: 'relationship',
      index: true,
      relationTo: 'polls',
      required: true,
    },
    {
      name: 'member',
      type: 'relationship',
      index: true,
      relationTo: 'members',
      required: true,
    },
    {
      name: 'optionId',
      type: 'text',
      admin: {
        description: 'References Polls.options[].optionId.',
      },
      required: true,
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, operation, req }) => {
        if (operation !== 'create' || !data?.poll || !data?.optionId) {
          return data
        }
        const poll = await req.payload.findByID({
          id: data.poll,
          collection: 'polls',
          overrideAccess: true,
        })
        if (!poll || poll.status !== 'active') {
          throw new Error('Poll is not active.')
        }
        const valid =
          Array.isArray(poll.options) && poll.options.some((o) => o?.optionId === data.optionId)
        if (!valid) {
          throw new Error('optionId does not match any poll option.')
        }
        return data
      },
    ],
  },
  indexes: [
    {
      fields: ['poll', 'member'],
      unique: true,
    },
    {
      fields: ['poll', 'optionId'],
    },
  ],
}
