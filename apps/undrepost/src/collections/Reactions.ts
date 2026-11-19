import type { CollectionConfig } from 'payload'

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
