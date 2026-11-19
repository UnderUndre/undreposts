import type { CollectionConfig } from 'payload'

import { isAdminOrAuthor } from '../access/roles'
import { toggleReactionEndpoint } from '../endpoints/reactions'
import { runSyndication } from '../syndication/run'

export const Posts: CollectionConfig = {
  slug: 'posts',
  access: {
    // Public sees published posts only; members see everything (draft review).
    create: ({ req }) => Boolean(req.user),
    delete: isAdminOrAuthor,
    read: ({ req }) =>
      req.user
        ? true
        : {
            status: {
              equals: 'published',
            },
          },
    update: isAdminOrAuthor,
  },
  admin: {
    defaultSort: '-publishedAt',
    useAsTitle: 'title',
  },
  // Collection-scoped custom routes: the router strips the slug before
  // matching, so the path here is relative to /api/posts.
  endpoints: [
    {
      handler: toggleReactionEndpoint.handler,
      method: 'post',
      path: '/:id/reactions',
    },
  ],
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      admin: {
        description: 'URL path segment: /blog/<slug>. Unique per instance (data-model).',
        position: 'sidebar',
      },
      index: true,
      required: true,
      unique: true,
    },
    {
      name: 'content',
      type: 'richText',
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
      name: 'status',
      type: 'select',
      admin: {
        position: 'sidebar',
      },
      defaultValue: 'draft',
      options: ['draft', 'published', 'archived'],
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
      },
      index: true,
    },
    {
      name: 'excerpt',
      type: 'textarea',
      admin: {
        description: 'Short summary for list views, RSS and SEO fallback.',
      },
    },
    {
      name: 'tags',
      type: 'array',
      fields: [
        {
          name: 'tag',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
    },
  ],
  hooks: {
    afterChange: [
      ({ doc, operation, previousDoc, req }) => {
        // T2.17 / FR-045: syndicate on the FIRST transition to published
        // (create-as-published or draft → published update). Fire-and-forget
        // with full error containment (FM-02: platform failures never fail
        // the local publication).
        if (
          (operation === 'create' || operation === 'update') &&
          doc.status === 'published' &&
          previousDoc?.status !== 'published' &&
          process.env.SYNDICATION_DISABLED !== 'true'
        ) {
          void runSyndication(req.payload, {
            id: doc.id,
            slug: (doc.slug as string | undefined) ?? null,
            excerpt: (doc.excerpt as string | undefined) ?? null,
            title: doc.title as string,
          }).catch((err: unknown) => {
            req.payload.logger.warn({ err, msg: 'syndication-unhandled' })
          })
        }
      },
    ],
    beforeChange: [
      ({ data }) => {
        // Stamp publishedAt once, on first transition to published.
        if (data?.status === 'published' && !data?.publishedAt) {
          data.publishedAt = new Date().toISOString()
        }
        return data
      },
    ],
  },
  indexes: [
    {
      fields: ['slug'],
      unique: true,
    },
    {
      fields: ['publishedAt'],
    },
  ],
}

/*
 * NOTE (data-model deviation, antigravity F3): data-model.md lists a `meta`
 * (object) group on Posts for tags/excerpts. @payloadcms/plugin-seo hard-codes
 * its SEO field group under `meta` (packages/plugin-seo/src/index.ts:54), so the
 * group was split into top-level `tags` / `excerpt` fields to avoid a field-path
 * collision. SEO metadata itself lives in `meta` (title/description/image) via
 * seoPlugin. Update data-model.md during the T4.3 documentation pass.
 */
