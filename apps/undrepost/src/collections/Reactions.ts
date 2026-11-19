import type { CollectionConfig } from 'payload'

import { bumpReactionCounter } from '../endpoints/reactions'
import { readCounters } from '../lib/counters'
import { emitEvent, postTopic } from '../lib/events'

export const Reactions: CollectionConfig = {
  slug: 'reactions',
  access: {
    create: ({ req }) => Boolean(req.user),
    read: () => true,
    // Toggle semantics: reactions are added/removed via create/delete — never edited.
    delete: ({ req }) => Boolean(req.user),
    update: () => false,
  },
  admin: {
    defaultSort: '-createdAt',
    useAsTitle: 'emojiRef',
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
      name: 'emojiRef',
      type: 'text',
      admin: {
        description:
          'Emoji shortcode (e.g. ":pepe:") or unicode literal. Server-managed shortcodes resolve against CustomEmoji.',
      },
      required: true,
    },
  ],
  hooks: {
    // Authorship is server-side: the client cannot set `author` (spoofing guard).
    afterChange: [
      async ({ doc, operation, req }) => {
        const postRel = typeof doc.post === 'object' && doc.post ? doc.post.id : doc.post
        // T2.4: materialized counter maintenance + SSE event (T2.3).
        if (operation === 'create') {
          await bumpReactionCounter(req.payload, postRel, doc.emojiRef as string, 1)
        } else if (operation === 'update') {
          // Reactions are immutable (update access denied) — no-op safety net.
          return
        }
        const counters = await readCounters(req.payload, { post: postRel })
        const counts: Record<string, number> = {}
        for (const row of counters) {
          counts[row.key] = row.count
        }
        emitEvent(postTopic(String(postRel)), {
          type: 'reaction.changed',
          data: { counts, emojiRef: doc.emojiRef },
        })
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        const postRel = typeof doc.post === 'object' && doc.post ? doc.post.id : doc.post
        await bumpReactionCounter(req.payload, postRel, doc.emojiRef as string, -1)
        const counters = await readCounters(req.payload, { post: postRel })
        const counts: Record<string, number> = {}
        for (const row of counters) {
          counts[row.key] = row.count
        }
        emitEvent(postTopic(String(postRel)), {
          type: 'reaction.changed',
          data: { counts, emojiRef: doc.emojiRef },
        })
      },
    ],
    beforeValidate: [
      ({ data, operation, req }) => {
        if (operation === 'create' && req.user) {
          data.author = req.user.id as string
        }
        return data
      },
    ],
  },
  // FR-020: one reaction per emoji per member per post.
  indexes: [
    {
      fields: ['post', 'author', 'emojiRef'],
      unique: true,
    },
    {
      fields: ['post', 'emojiRef'],
    },
  ],
}
