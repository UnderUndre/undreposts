import type { CollectionConfig } from 'payload'

import { isAdminOrAuthor } from '../access/roles'
import { emitEvent, postTopic } from '../lib/events'
import { checkRateLimit, COMMENT_RATE_LIMIT } from '../lib/rateLimit'

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
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== 'create') {
          return
        }
        // doc.author / doc.post may be populated objects or raw ids depending
        // on the caller depth — extract the raw id cleanly.
        const authorId = typeof doc.author === 'object' && doc.author ? doc.author.id : doc.author
        const postId = typeof doc.post === 'object' && doc.post ? doc.post.id : doc.post
        let authorDisplayName =
          typeof doc.author === 'object' && doc.author?.displayName
            ? String(doc.author.displayName)
            : ''
        if (!authorDisplayName && authorId) {
          try {
            const member = await req.payload.findByID({
              id: authorId,
              collection: 'members',
              overrideAccess: true,
            })
            authorDisplayName = (member?.displayName as string | undefined) ?? ''
          } catch {
            authorDisplayName = ''
          }
        }
        emitEvent(postTopic(String(postId)), {
          type: 'comment.created',
          data: {
            authorDisplayName,
            body: doc.body,
            commentId: doc.id,
          },
        })
      },
    ],
    beforeValidate: [
      ({ data, operation, req }) => {
        if (operation !== 'create') {
          return data
        }
        // T2.1b pluggable gating: policy seam + FR-011 rate limit (default
        // 10 comments/hour per member; Redis-backed shared limiter lands
        // with T2.7). Member-only is already enforced by access.create.
        const policy = process.env.COMMENT_POLICY || 'default'
        if (policy === 'disabled') {
          throw new Error('Commenting is disabled on this instance.')
        }
        if (req.user && !checkRateLimit(`comment:${String(req.user.id)}`, COMMENT_RATE_LIMIT)) {
          throw new Error('Comment rate limit exceeded — try again later.')
        }
        // Authorship is server-side: the client cannot set `author`.
        if (req.user) {
          data.author = req.user.id
        }
        return data
      },
    ],
  },
  indexes: [
    {
      fields: ['post'],
    },
    {
      fields: ['createdAt'],
    },
  ],
}
