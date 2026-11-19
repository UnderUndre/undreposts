import type { CollectionConfig } from 'payload'

import { bumpCounter, readCounters } from '../lib/counters'
import { emitEvent, pollTopic } from '../lib/events'

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
    afterChange: [
      async ({ doc, operation, req }) => {
        const pollRel = typeof doc.poll === 'object' && doc.poll ? doc.poll.id : doc.poll
        // T2.4: counter maintenance + SSE event (T2.3) — single source of
        // truth for both the vote endpoint and admin-created votes.
        if (operation === 'create') {
          await bumpCounter(req.payload, { key: doc.optionId as string, poll: pollRel }, 1)
        } else {
          return
        }
        const counters = await readCounters(req.payload, { poll: pollRel })
        const counts: Record<string, number> = {}
        for (const row of counters) {
          counts[row.key] = row.count
        }
        emitEvent(pollTopic(String(pollRel)), {
          type: 'poll.voted',
          data: { counts, optionId: doc.optionId },
        })
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        const pollRel = typeof doc.poll === 'object' && doc.poll ? doc.poll.id : doc.poll
        await bumpCounter(req.payload, { key: doc.optionId as string, poll: pollRel }, -1)
      },
    ],
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
