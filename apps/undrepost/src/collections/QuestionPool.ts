import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/roles'

/**
 * FR-046 status-mirror (post-Wave-1): undrepost stores the question + status
 * only. Pledge ledger and threshold live in undrepay (FR-003 money-state
 * boundary) — `funded` is set exclusively by an undrepay webhook.
 */
export const QuestionPool: CollectionConfig = {
  slug: 'question-pool',
  access: {
    create: ({ req }) => Boolean(req.user),
    delete: isAdmin,
    read: () => true,
    update: isAdmin,
  },
  admin: {
    useAsTitle: 'question',
  },
  fields: [
    {
      name: 'question',
      type: 'textarea',
      required: true,
    },
    {
      name: 'askedBy',
      type: 'relationship',
      index: true,
      relationTo: 'members',
    },
    {
      name: 'status',
      type: 'select',
      admin: {
        description:
          'Single state encoding — no separate funded boolean (analyze U2). "funded" set only by undrepay webhook.',
      },
      defaultValue: 'open',
      index: true,
      options: ['open', 'funded', 'answered'],
    },
    {
      name: 'answerPost',
      type: 'relationship',
      admin: {
        description: 'Set when the author answers with a post.',
      },
      relationTo: 'posts',
    },
  ],
  indexes: [
    {
      fields: ['status'],
    },
  ],
}
