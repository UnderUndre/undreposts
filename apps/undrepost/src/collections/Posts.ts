import type { CollectionConfig } from 'payload'

import { isAdminOrAuthor } from '../access/roles'

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
